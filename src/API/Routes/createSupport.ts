import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { WithId } from "mongodb";
import { User } from "../../Types";

import { v4 as uuid } from "uuid";

export default class CreateSupport extends Route {
    name: string;

    constructor(client: Client) {
        super('/createSupport', 'post', client);

        this.name = 'createSupport';

        this.requiredAuth = true;
    }

    async execute(req: Request, res: Response, User: WithId<User>): Promise<Response> {
        let { name, iconURL } = req.query as {
            user: string,
            password: string,
            name: string,
            iconURL: string
        }

        const Users = this.client.mongo.db("EMAKE").collection("users");

        if (User.support) return res.send({
            status: true
        })

        Users.updateOne({ user: User.password, password: User.password }, { $set: { support: true, name, iconURL } });

        const botMessages = ["Olá! Seja bem-vindo ao suporte da EMAKE. Aqui você poderá tirar todas as suas dúvidas a respeito do APP, fazer reporte de erros ou sugestões do nosso app.", 'Fique á vontade para deixar especificado a sua mensagem, para que o atendimento seja mais rápido.', 'Em breve um membro de nosso suporte irá atendê-lo.'];

        const admins = await Users.find({ admin: true }).toArray() as Array<WithId<User>>;

        for (const admin of admins) {
            this.client.API.postNotification({
                user: admin,
                title: `Novo atendimento aberto`,
                body: `${name} abriu um atendimento. (${User.user})`
            })
        }
        for (let i = 0; i < botMessages.length; i++) {
            setTimeout(async () => {
                if (!User.messages) User.messages = [];

                User.messages.push({ content: botMessages[i], author: "EMAKE", date: Date.now(), id: uuid(), iconURL: 'https://media.discordapp.net/attachments/1091540686777634826/1144101172978921573/logo.png' });

                Users.updateOne({ user: User.user, password: User.password }, {
                    $set: {
                        messages: User.messages
                    }
                });

                this.client.API.postNotification({
                    user: User,
                    title: `EMAKE respondeu ao seu atendimento`,
                    body: `EMAKE: ${botMessages[i]}`,
                    data: {
                        content: botMessages[i],
                        date: Date.now().toString(),
                        iconURL: 'https://media.discordapp.net/attachments/1091540686777634826/1144101172978921573/logo.png',
                        author: 'EMAKE',
                        contact: name || 'EMAKE'
                    }
                });

                for (const admin of admins) {
                    this.client.API.postNotification({
                        user: admin,
                        title: 'EMAKE enviou uma mensagem em um atendimento',
                        body: 'Clique para detalhar',
                        data: {
                            content: botMessages[i],
                            date: Date.now.toString(),
                            iconURL: 'https://media.discordapp.net/attachments/1091540686777634826/1144101172978921573/logo.png',
                            author: 'EMAKE',
                            contact: name || 'EMAKE'
                        }
                    })
                }
            }, i * 2000)
        }

        return res.send({
            messages: User.messages
        })
    }
}

