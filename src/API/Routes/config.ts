import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { WithId } from "mongodb";
import { User } from "../../Types";

export default class Config extends Route {
    name: string;

    constructor(client: Client) {
        super('/config', 'get', client);

        this.name = 'config';

        this.requiredAuth = true;
    }

    async execute(req: Request, res: Response, User: WithId<User>): Promise<Response> {
        return res.send({
            status: true,
            materiais: User.materiais,
            faltas: User.faltas,
            notas: User.notas
        })
    }
}

