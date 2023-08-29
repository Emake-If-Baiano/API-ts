import { NextFunction, Request, Response } from "express";
import Route from "../../Structures/Route";

import Client from "../../client/Client";
import { WithId } from "mongodb";
import { User } from "../../Types";

export default class Version extends Route {
    name: string;

    constructor(client: Client) {
        super('/postToken', 'post', client);

        this.name = 'postToken';
    }

    async execute(req: Request, res: Response, next?: NextFunction): Promise<Response> {
        let { user, password, token } = req.body;

        user = user.toLowerCase();

        const Users = this.client.mongo.db("EMAKE").collection("users");

        const checkExists = await Users.findOne({ user, password });

        let u = checkExists as WithId<User> || await Users.insertOne({
            user,
            password,
            postToken: token,
            notas: true,
            materiais: true,
            faltas: true
        })

        res.send({
            status: true
        });

        if (checkExists) {
            (u).postToken = token;

            Users.updateOne({ user, password }, {
                $set: {
                    postToken: token
                }
            });

            return res.end();

        } else {

            const login = await this.client.modules.get('suap').login((u).user, (u).password);

            u = await Users.findOne({ user, password }) as WithId<User>;

            if (!login) return res.end();

            u.token = login.access;

            Users.updateOne({ user, password }, {
                $set: {
                    token: login.access
                }
            })

            const periodos = await this.client.modules.get('suap').obterPeriodosLetivos(u.token);

            if (!periodos.length) return res.end();

            semestre: for (const periodo of periodos.reverse()) {
                const check = await new Promise(async resolve2 => {
                    const boletim = await this.client.modules.get('suap').getBoletim(u.token, periodo.ano_letivo, periodo.periodo_letivo);

                    if (boletim.length) {

                        u.periodo = periodo;

                        Users.updateOne({ user, password }, {
                            $set: {
                                periodo: u.periodo
                            }
                        })
                        resolve2(true)
                    } else resolve2(false);
                })

                if (check) break semestre
            };

            return res.end();
        }
    }
}

