import { NextFunction, Request, Response } from "express";

import Route from "../../Structures/Route";

import Client from "../../client/Client";

import { readFileSync } from "fs";

export default class Privacidade extends Route {
    name: string;

    constructor(client: Client) {
        super('/privacidade', 'get', client);

        this.name = 'privacidade';
    }

    async execute(req: Request, res: Response): Promise<Response> {
        res.setHeader('Content-Type', 'text/html');

        return res.send(readFileSync('./politicas.html'))
    }
}

