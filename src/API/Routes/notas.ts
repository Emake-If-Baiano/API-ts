import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { CustomBrowser } from "../../Types";
import { load } from "cheerio";

export default class Notas extends Route {
    name: string;

    constructor(client: Client) {
        super('/notas', 'get', client);

        this.name = 'notas';
    }

    async execute(req: Request, res: Response, next?: NextFunction): Promise<Response> {
        const timer = await this.createTimer(res);

        const { user, password, ano, periodo, codigo } = req.query as {
            user: string,
            password: string,
            ano: string,
            periodo: string,
            codigo: string
        }

        const launch = this.client.API.launch;

        (this.client.API.launchers.get(launch.key) as CustomBrowser).requests++

        const initialPage = await launch.launch.newPage();

        await initialPage.goto('https://suap.ifbaiano.edu.br/accounts/login/');

        await initialPage.waitForSelector('#id_username');

        await initialPage.type('#id_username', user);

        await initialPage.type(".password-input", password)

        await initialPage.click("body > div.holder > main > div > div:nth-child(1) > form > div.submit-row > input");

        await initialPage.waitForSelector("body > div > a.toggleSidebar");

        await initialPage.goto(`https://suap.ifbaiano.edu.br/edu/aluno/${user.toUpperCase()}/?tab=boletim&ano_periodo=${ano}_${periodo}`, { waitUntil: 'networkidle2', timeout: 0 });

        let $ = load(await initialPage.content());

        const href = $(`tr:has(> td:contains("${codigo}")) > td > a`).attr(
            "href"
        );

        await initialPage.goto(`https://suap.ifbaiano.edu.br${href}`, { waitUntil: 'networkidle2', timeout: 0 });

        $ = load(await initialPage.content());

        const teachers = $("#content > div:nth-child(3) > div").text()

        const titles = $("#content > div:nth-child(4) > div > h4")
            .toArray()
            .map((el) => $(el).text().replace(/\s+/g, " "))

        const data = $("#content > div:nth-child(4) > div > table")
            .toArray()
            .map((el) => {
                const $el = $(el)
                const data = $el
                    .find("td")
                    .toArray()
                    .map((el) => $(el).text())
                const result = [] as Array<Object>

                this.chunk(data, 5).forEach((chunk) => {
                    result.push({
                        Sigla: chunk[0],
                        Tipo: chunk[1],
                        Descrição: chunk[2],
                        Peso: chunk[3],
                        "Nota Obtida": chunk[4]
                    })
                })
                return result
            })

        this.clearTimer(timer);

        initialPage.close();

        (this.client.API.launchers.get(launch.key) as CustomBrowser).requests--;
        return res.send({
            Professores: teachers.trim(),
            "Detalhamento das Notas": this.zipObject(titles, data)
        })
    }

    chunk(array: Array<string>, n: number): Array<Array<string>> {
        return array.reduce((acc: Array<Array<string>>, val: string, i: number) => {
            if (i % n === 0) {
                acc.push([val])
            } else {
                acc[acc.length - 1].push(val)
            }
            return acc
        }, [])
    }

    zipObject(keys: Array<string>, values: Array<Array<Object>>): Object {
        return keys.reduce((acc: any, key: string, i: number) => {
            acc[key] = values[i]
            return acc
        }, {})
    }
}

