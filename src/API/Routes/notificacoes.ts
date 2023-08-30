import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { load } from "cheerio";
import { CustomBrowser } from "../../Types";

export default class Notificacoes extends Route {
    name: string;

    constructor(client: Client) {
        super('/notificacoes', 'get', client);

        this.name = 'notificacoes';

        this.requiredAuth = true;
    }

    async execute(req: Request, res: Response): Promise<Response> {
        const timer = await this.createTimer(res);

        const { user, password } = req.query;

        const launch = this.client.API.launch;

        (this.client.API.launchers.get(launch.key) as CustomBrowser).requests++;

        const initialPage = await launch.launch.newPage();

        await initialPage.goto('https://suap.ifbaiano.edu.br/accounts/login/');

        await initialPage.waitForSelector('#id_username');

        await initialPage.type('#id_username', user as string);

        await initialPage.type(".password-input", password as string)

        await initialPage.click("body > div.holder > main > div > div:nth-child(1) > form > div.submit-row > input");

        await initialPage.waitForSelector("body > div > a.toggleSidebar");

        await initialPage.goto("https://suap.ifbaiano.edu.br/comum/notificacoes/");

        return await initialPage.waitForSelector("#content > div.list-articles > ul", {
            timeout: 5000
        }).then(async () => {
            let $ = load(await initialPage.content());

            const response = [] as Array<{ titulo: string, fields: Array<string> }>;

            $("#content > div.list-articles > ul").each((i, ul) => {
                $(ul).find("li").each((i, li) => {
                    const selec = $(li).find("a");

                    const selectP = $(selec).find("p");

                    const selectH = $(selec).find("h4");

                    response.push({
                        titulo: $(selectH).text(),
                        fields: selectP.toArray().map((el) => $(el).text().replace(/\s+/g, " "))
                    })
                })
            });

            this.clearTimer(timer);

            initialPage.close();

            (this.client.API.launchers.get(launch.key) as CustomBrowser).requests--;

            return res.json(response.filter(r => r.titulo));
        }).catch(err => {
            initialPage.close();

            this.clearTimer(timer);

            (this.client.API.launchers.get(launch.key) as CustomBrowser).requests--;

            return res.json([])
        })
    }
}

