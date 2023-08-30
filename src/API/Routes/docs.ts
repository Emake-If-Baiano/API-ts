import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { CustomBrowser } from "../../Types";
import { load } from "cheerio";

export default class Docs extends Route {
    name: string;

    constructor(client: Client) {
        super('/docs', 'get', client);

        this.name = 'docs';

        this.requiredAuth = true;
    }

    async execute(req: Request, res: Response): Promise<Response> {
        const timer = await this.createTimer(res);

        const { user, password } = req.query as {
            user: string,
            password: string
        }

        const launch = this.client.API.launch;

        try {
            (this.client.API.launchers.get(launch.key) as CustomBrowser).requests++;

            const initialPage = await launch.launch.newPage();

            await initialPage.goto('https://suap.ifbaiano.edu.br/accounts/login/');

            await initialPage.waitForSelector('#id_username');

            await initialPage.type('#id_username', user);

            await initialPage.type(".password-input", password)

            await initialPage.click("body > div.holder > main > div > div:nth-child(1) > form > div.submit-row > input");

            await initialPage.waitForSelector("body > div > a.toggleSidebar", {
                timeout: 5000
            }).catch(err => {
                initialPage.close();

                (this.client.API.launchers.get(launch.key) as CustomBrowser).requests--;

                this.clearTimer(timer);

                res.send({
                    status: false,
                    data: []
                }).end();
            })

            await initialPage.goto(`https://suap.ifbaiano.edu.br/edu/aluno/${user.toUpperCase()}`);

            const $ = load(await initialPage.content());

            const documents = $(
                "#content > div.title-container > div.action-bar-container > ul > li:nth-child(2) > ul > li > a"
            ).toArray()
                .map((el) => {

                    const $el = $(el)
                    return {
                        nome: $el.text(),
                        link: $el.attr("href")
                    }
                });

            initialPage.close();

            (this.client.API.launchers.get(launch.key) as CustomBrowser).requests--;

            this.clearTimer(timer);

            return res.send({
                status: true,
                data: documents
            }).end();
        } catch (err) {

            (this.client.API.launchers.get(launch.key) as CustomBrowser).requests--;

            this.clearTimer(timer);

            return res.send({
                status: true,
                data: []
            }).end();
        }
    }
}

