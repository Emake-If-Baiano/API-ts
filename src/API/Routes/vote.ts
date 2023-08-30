import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { WithId } from "mongodb";
import { User } from "../../Types";

import { v4 as uuid } from "uuid";

export default class Vote extends Route {
    name: string;

    constructor(client: Client) {
        super('/vote', 'post', client);

        this.name = 'vote';

        this.requiredAuth = true;
    }

    async execute(req: Request, res: Response, User: WithId<User>): Promise<Response> {
        const { contact } = req.body as {
            contact: string,
        }

        const Users = this.client.mongo.db("EMAKE").collection("users");

        const checkExists = await Users.findOne({ name: contact }) as WithId<User>;

        if (!checkExists) return res.send({
            status: false
        });

        const obj = {
            content: `Agradecemos à avaliação, será de grande ajuda para melhorarmos nosso suporte.`,
            author: "EMAKE",
            date: Date.now().toString(),
            uuid: uuid(),
            iconURL: 'https://media.discordapp.net/attachments/1091540686777634826/1144101172978921573/logo.png',
            contact: contact || 'EMAKE'
        };

        if (!checkExists.messages?.length) checkExists.messages = [];

        checkExists.messages.push(obj);

        Users.updateOne({
            name: contact
        }, {
            $set: {
                messages: checkExists.messages
            }
        });

        await this.client.API.postNotification({
            user: checkExists,
            title: `Agradecemos à avaliação, será de grande ajuda para melhorarmos nosso suporte.`,
            body: "Esperamos ter te ajudado!",
            data: obj
        });

        const admins = await Users.find({ admin: true }).toArray() as Array<WithId<User>>;

        for (const admin of admins) {
            await this.client.API.postNotification({
                user: admin,
                title: `Atendimento finalizado`,
                body: `Atendimento de ${checkExists.user} finalizado.`,
                data: obj
            });
        };

        return res.send({
            status: true
        })
    }
}

