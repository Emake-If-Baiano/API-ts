import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { Message } from "../../Types";

export default class Messages extends Route {
    name: string;

    constructor(client: Client) {
        super('/messages', 'get', client);

        this.name = 'messages';

        this.requiredAuth = true;
    }

    async execute(req: Request, res: Response, next?: NextFunction): Promise<Response> {
        let { user, password, contact } = req.query as {
            user: string,
            password: string,
            contact: string
        }

        user = user.toLowerCase();

        const Users = this.client.mongo.db("EMAKE").collection("users");

        const checkExists = await Users.findOne({ user, password });

        if (!checkExists) return res.send({
            status: false
        });

        const isAdmin = checkExists.admin;

        if (isAdmin) {
            if (contact !== "EMAKE") {
                const userMessages = await Users.findOne({ name: contact });

                if (userMessages) return res.send({
                    status: true,
                    messages: userMessages.messages
                });

                return res.send({
                    status: true,
                    messages: []
                })
            };

            const usersWithSupport = await Users.find({ support: true }).toArray();

            return res.send({
                contacts: usersWithSupport.map(userA => ({
                    matricula: userA.user,
                    name: userA.name,
                    iconURL: userA.iconURL,
                    lastMessage: userA.messages.sort((a: Message, b: Message) => Number(b.date) - Number(a.date))[0]
                }))
            })
        } else {
            return res.send({
                messages: checkExists.messages || [],
                isAdmin: false
            });
        }
    }
}

