import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { CustomBrowser } from "../../Types";
import { load } from "cheerio";
import { ElementHandle } from "puppeteer";

export default class Calendario extends Route {
    name: string;

    constructor(client: Client) {
        super('/calendario', 'get', client);

        this.name = 'calendario';
    }

    async execute(req: Request, res: Response, next?: NextFunction): Promise<Response> {
        const timer = await this.createTimer(res);

        const { user, password } = req.query;

        const launch = this.client.API.launch;

        (this.client.API.launchers.get(launch.key) as CustomBrowser).requests += 1;

        const initialPage = await launch.launch.newPage();

        await initialPage.goto('https://suap.ifbaiano.edu.br/accounts/login/');

        await initialPage.waitForSelector('#id_username');

        await initialPage.type('#id_username', user as string);

        await initialPage.type(".password-input", password as string);

        await initialPage.click("body > div.holder > main > div > div:nth-child(1) > form > div.submit-row > input");

        await initialPage.waitForSelector("body > div > a.toggleSidebar").catch(err => {
            res.json([]);

            res.end();
        })

        let $ = load(await initialPage.content());

        const link = $('a:contains(" Calendário Completo")').attr("href")

        if (!link) return res.json([]);

        await initialPage.goto(`https://suap.ifbaiano.edu.br${link}`);

        await initialPage.waitForSelector("#content > div.calendarios-container").catch(err => {
            res.json([]);

            res.end();
        })

        const response = [] as Array<{ buffer: Buffer | string, indice: number }>;

        $ = load(await initialPage.content());

        return await Promise.all($("#content > div.calendarios-container").map((i, ul) => {
            return Promise.all($(ul).find("div.calendario").map(async (i, div) => {
                return new Promise(async resolve => {
                    const p = await initialPage.$(`#content > div.calendarios-container > div:nth-child(${i + 1})`);

                    const shot = await (p as ElementHandle).screenshot({
                        type: "png",
                        encoding: "base64",
                    });

                    response.push({
                        buffer: shot,
                        indice: i
                    });

                    resolve(true)
                })
            }))
        })).then(e => {

            initialPage.close();

            (this.client.API.launchers.get(launch.key) as CustomBrowser).requests--;

            this.clearTimer(timer);

            return res.json(response)
        })
    }
}

