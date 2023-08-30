import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { RssItem } from "../../Types";
import { load } from "cheerio";

export default class Campus extends Route {
    name: string;

    constructor(client: Client) {
        super('/campus', 'get', client);

        this.name = 'campus';

        this.timeout = 100;
    }

    async execute(req: Request, res: Response): Promise<Response> {
        const timer = await this.createTimer(res);

        const format = {
            "TDF": "teixeira",
            "ITA": "itapetinga",
            "ITN": "itaberaba",
            "CAT": "catu",
            "BJL": "lapa",
            "SBF": "bonfim",
            "ALG": "alagoinhas",
            "URU": "urucuca",
            "SER": "serrinha",
            "GBI": "guanambi",
            "VAL": "valenca",
            "CSI": "santaines",
            "XIQ": "xique-xique"
        };

        const { campus } = req.query as {
            campus: keyof typeof format
        }

        const selected = format[campus];

        const data = await axios.get(`https://www.ifbaiano.edu.br/unidades/${selected}/feed`);
        if (!data.data) {
            console.log(`INVALIDO`, selected, format[campus])
            this.clearTimer(timer);

            return res.json([])
        }

        let $ = new XMLParser().parse(data.data);

        this.clearTimer(timer);

        return res.json($.rss.channel.item?.sort((a: RssItem, b: RssItem) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()).map((e: any) => {
            return {
                nome: load(e.title)("body").text(),
                link: load(e['content:encoded'] ? e['content:encoded'] : e.description)('img').attr("src"),
                site: load(e.link)("body").text()
            }
        }).filter((e: RssItem) => e.link.length && e.site.length) || [])
    }
}

