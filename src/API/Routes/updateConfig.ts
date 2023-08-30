import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { WithId } from "mongodb";
import { User } from "../../Types";

export default class UpdateConfig extends Route {
    name: string;

    constructor(client: Client) {
        super('/updateConfig', 'get', client);

        this.name = 'updateConfig';

        this.requiredAuth = true;

        this.timeout = 0;
    }

    async execute(req: Request, res: Response, User: WithId<User>): Promise<Response> {
        let { data } = req.query as {
            user: string,
            password: string,
            data: any
        }

        data = JSON.parse(data);

        const Users = this.client.mongo.db("EMAKE").collection("users");

        if (data.notas) User.notas = !User.notas;

        if (data.faltas) User.faltas = !User.faltas;

        if (data.materiais) User.materiais = !User.materiais;

        Users.updateOne({ user: User.user, password: User.password }, {
            $set: {
                notas: User.notas,
                faltas: User.faltas,
                materiais: User.materiais
            }
        })

        return res.send({
            status: true
        })
    }
}

