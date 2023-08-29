import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";

export default class Version extends Route {
    name: string;

    constructor(client: Client) {
        super('/version', 'get', client);

        this.name = 'version';
    }

    async execute(req: Request, res: Response, next?: NextFunction): Promise<Response> {
        return res.send({
            version: this.client.version
        });
    }
}

