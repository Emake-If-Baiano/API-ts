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

        this.requiredAuth = true;
    }

    async execute(req: Request, res: Response): Promise<Response> {
        const timer = await this.createTimer(res);

        const { user, password } = req.query;

        const launch = this.client.API.launch;

        (this.client.API.launchers.get(launch.key) as CustomBrowser).requests += 1;

        const initialPage = await launch.launch.newPage();

        initialPage.setRequestInterception(true);

        initialPage.on('request', (request) => {
            if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
                if (request.url().includes('calendario')) {
                    request.continue().catch(Err => true);
                } else {
                    request.abort().catch(err => true)
                }
            } else {
                request.continue().catch(err => true)
            }
        })

        await initialPage.goto('https://suap.ifbaiano.edu.br/accounts/login/');

        await initialPage.waitForSelector('#id_username');

        await initialPage.type('#id_username', user as string);

        await initialPage.type(".password-input", password as string);

        await initialPage.click("body > div.holder > main > div > div:nth-child(1) > form > div.submit-row > input");

        return await initialPage.waitForResponse("https://suap.ifbaiano.edu.br/comum/index/meus_quadros/")
            .then(async response => {
                const json = await response.json() as { [key: string]: Array<string> };

                const array = Object.values(json).reduce((a: Array<string>, b: Array<string>) => {
                    return a.concat(b)
                }, [])

                if (array.includes("CALENDÁRIO ACADÊMICO")) {
                    await initialPage.goto(`https://suap.ifbaiano.edu.br/comum/index/meu_quadro/Q0FMRU5Ew4FSSU8gQUNBRMOKTUlDTw==/`);

                    let $ = load(await initialPage.content());

                    const a = $('a')[1];

                    const link = $(a).attr("href");

                    await initialPage.setRequestInterception(false);

                    await initialPage.goto(`https://suap.ifbaiano.edu.br${link}`);

                    await initialPage.waitForSelector("#content > div.calendarios-container").catch(err => {
                        res.json([]);
                        res.end();
                    })

                    $ = load(await initialPage.content());

                    const response = [] as Array<{ buffer: Buffer | string, indice: number }>;

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
                } else {
                    res.json([])

                    return res.end();
                }
            })
            .catch(err => {
                res.json([]);

                return res.end();
            });
    }
}

