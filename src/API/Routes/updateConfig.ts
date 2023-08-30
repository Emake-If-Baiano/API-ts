import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";

export default class UpdateConfig extends Route {
    name: string;

    constructor(client: Client) {
        super('/updateConfig', 'get', client);

        this.name = 'updateConfig';

        this.requiredAuth = true;
    }

    async execute(req: Request, res: Response, next?: NextFunction): Promise<Response> {
        let { user, password, data } = req.query as {
            user: string,
            password: string,
            data: any
        }

        data = JSON.parse(data);

        user = user.toLowerCase();

        const Users = this.client.mongo.db("EMAKE").collection("users");

        const u = await Users.findOne({
            user, password
        });

        if (!u) return res.send({
            status: false
        });

        if (data.notas) u.notas = !u.notas;

        if (data.faltas) u.faltas = !u.faltas;

        if (data.materiais) u.materiais = !u.materiais;

        Users.updateOne({ user, password }, {
            $set: {
                notas: u.notas,
                faltas: u.faltas,
                materiais: u.materiais
            }
        })

        return res.send({
            status: true
        })
    }
}

