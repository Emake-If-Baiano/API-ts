import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { WithId } from "mongodb";
import { User } from "../../Types";

import { v4 as uuid } from "uuid";

export default class CloseTicket extends Route {
    name: string;

    constructor(client: Client) {
        super('/closeTicket', 'post', client);

        this.name = 'closeTicket';

        this.requiredAuth = true;
    }

    async execute(req: Request, res: Response, User: WithId<User>): Promise<Response> {
        const { contact } = req.body;

        const Users = this.client.mongo.db("EMAKE").collection("users");

        const checkExists = await Users.findOne({ name: contact }) as WithId<User>;

        if (!checkExists) return res.send({
            status: false
        });

        if (contact === User.name || User.admin) {
            const message = "Atendimento finalizado! Esperamos ter sanado todas as suas dúvidas.";

            const secondMessage = "Dê uma nota ao atendimento";

            const obj = {
                content: message,
                author: "EMAKE",
                uuid: uuid(),
                date: Date.now().toString(),
                iconURL: 'https://media.discordapp.net/attachments/1091540686777634826/1144101172978921573/logo.png',
                contact: contact || 'EMAKE'
            };

            const secondObj = {
                content: secondMessage,
                author: "EMAKE",
                uuid: uuid(),
                date: Date.now().toString(),
                iconURL: 'https://media.discordapp.net/attachments/1091540686777634826/1144101172978921573/logo.png',
                special: 'vote',
                contact: contact || "EMAKE"
            }

            if (!checkExists.messages?.length) checkExists.messages = [];

            checkExists.messages.push(obj, secondObj);

            Users.updateOne({
                name: contact
            }, {
                $set: {
                    support: false,
                    messages: checkExists.messages
                }
            });

            await this.client.API.postNotification({
                user: checkExists,
                title: message,
                body: "Esperamos ter te ajudado!",
                data: obj
            });

            await this.client.API.postNotification({
                user: checkExists,
                title: secondMessage,
                body: 'Dê uma nota ao atendimento',
                data: secondObj
            });

            const admins = await Users.find({ admin: true }).toArray() as Array<WithId<User>>;

            for (const admin of admins) {
                await this.client.API.postNotification({
                    user: admin,
                    title: `Atendimento finalizado`,
                    body: `Atendimento de ${checkExists.user} finalizado.`,
                    data: obj
                });

                await this.client.API.postNotification({
                    user: admin,
                    title: secondMessage,
                    body: `Dê uma nota ao atendimento`,
                    data: secondObj
                })
            };

            return res.send({
                status: true
            })
        } else {
            return res.send({
                status: false
            })
        }
    }
}

