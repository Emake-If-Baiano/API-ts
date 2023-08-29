import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { WithId } from "mongodb";
import { User } from "../../Types";

import { v4 as uuid } from "uuid";

export default class postMessage extends Route {
    name: string;

    constructor(client: Client) {
        super('/postMessage', 'post', client);

        this.name = 'postMessage';
    }

    async execute(req: Request, res: Response, next?: NextFunction): Promise<Response> {
        let { user, password, message, contact } = req.body;

        user = user.toLowerCase();

        const Users = this.client.mongo.db("EMAKE").collection("users");

        const checkExistsAuthor = await Users.findOne({ user, password });

        if (!checkExistsAuthor) return res.send({
            status: false
        });

        const checkExists = await Users.findOne({ name: contact }) as WithId<User>;

        if (!checkExists) return res.send({
            status: false,
            error: 'No support created'
        });

        if (!checkExists.messages?.length) checkExists.messages = [];

        checkExists.messages.push({
            content: message.content,
            date: Date.now(),
            id: uuid(),
            iconURL: message.iconURL,
            author: message.author,
            contact: contact || 'EMAKE'
        });

        Users.updateOne({ name: contact }, {
            $set: {
                messages: checkExists.messages
            }
        });

        const admins = await Users.find({ admin: true }).toArray() as Array<WithId<User>>;

        for (const admin of admins) {
            this.client.API.postNotification({
                user: admin,
                title: `${message.author} respondeu a um atendimento`,
                body: `${message.content}`,
                data: {
                    content: message.content,
                    date: Date.now().toString(),
                    iconURL: message.iconURL,
                    author: message.author,
                    contact: contact || 'EMAKE'
                }
            })
        }
        this.client.API.postNotification({
            user: checkExists,
            title: `${message.author} respondeu ao seu atendimento`,
            body: `${message.author}: ${message.content}`,
            data: {
                content: message.content,
                date: Date.now().toString(),
                iconURL: message.iconURL,
                author: message.author,
                contact: contact || 'EMAKE'
            }
        })

        return res.send({
            status: true
        })
    }
}

