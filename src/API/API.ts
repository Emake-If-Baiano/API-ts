import express, { NextFunction, Request, Response } from "express";

import puppeteer from "puppeteer";

import admin from "firebase-admin";

import https from "https";

import fs from "fs";

import { Collection } from "@discordjs/collection";

import { v4 as uuid } from "uuid";

import Client from "../client/Client";

import { CustomBrowser, Module, NotificationData, User, RateLimit, RequestData } from "../Types";

import chalk from "chalk";

import { WithId } from "mongodb";
import Route from "../Structures/Route";

admin.initializeApp({
    credential: admin.credential.cert(require("../../service.json")),
});

const app = express();

app.use(express.json());

export default class API extends Module {

    launchers: Collection<number, CustomBrowser>;

    rateLimit: Collection<string, RateLimit>;

    routes: Collection<string, Route>

    constructor(client: Client) {
        super(client);

        this.client = client;

        this.name = 'api';

        this.launchers = new Collection();

        this.rateLimit = new Collection();

        this.routes = new Collection();
    }

    get launch(): CustomBrowser {
        return this.launchers.sort((a, b) => a.requests - b.requests).first() as CustomBrowser;
    }

    async loadRoutes() {
        const routes = fs.readdirSync('build/API/Routes');

        for (const route of routes) {
            const Route = require(`./Routes/${route}`).default;

            const routeInstance = new Route(this.client) as Route;

            this.routes.set(routeInstance.path, routeInstance)

            this.client.log(`Rota ${routeInstance.name} carregada.`, { tags: ['ROTAS'], color: 'magenta' });

            (app as any)[routeInstance.method](routeInstance.path, async (req: Request, res: Response, next: NextFunction) => {
                try {
                    const { user, password } = req.query as {
                        user: string,
                        password: string
                    };
                    const User = user ? await this.client.mongo.db("EMAKE").collection("users").findOne({ user: user.toLowerCase(), password }) : undefined;

                    await routeInstance.execute(req, res, User as WithId<User> | undefined);
                } catch (err) {
                    res.status(500).send({
                        status: false,
                        error: (err as Error).message
                    }).end();
                }
            })
        }
    }

    async handleRequest(req: Request, res: Response, next: NextFunction): Promise<any> {
        const route = this.client.API.routes.get(req.path);

        if (!route) return res.status(404).send({
            status: false,
            error: "Rota não encontrada"
        }).end();

        if (route.method.toLowerCase() !== req.method.toLowerCase()) return res.status(405).send({
            status: false,
            error: "Método não permitido"
        }).end();

        if (route.requiredAuth) {
            const { user, password } = req.query as {
                user: string,
                password: string
            };

            if (!user || !password) return res.status(400).send({
                status: false,
                error: "Credenciais não encontradas"
            }).end();

            const find = await this.client.mongo.db("EMAKE").collection("users").findOne({ user: user.toLowerCase(), password });

            if (!find) {
                this.checkRateLimit(req, res, () => {
                    res.status(401).send({
                        status: false,
                        error: "Credenciais inválidas"
                    }).end();
                }, true)
            } else {
                this.checkRateLimit(req, res, next, false)
            }
        } else {
            this.checkRateLimit(req, res, next, true)
        }
    };

    async start(): Promise<void> {

        this.client.API = this;

        this.startLaunchers();

        app.all('*', (req: Request, res: Response, next: NextFunction) => {
            this.handleRequest(req, res, next);
        });

        const server = https.createServer({
            key: fs.readFileSync('/home/container/key.pem'),
            cert: fs.readFileSync('/home/container/cert.pem')
        }, app);

        const PORT = process.env.PORT

        server.listen(PORT, () => {
            this.client.log(`API iniciada na porta ${PORT}`, { tags: ['API'], color: 'green' });
        });

        this.loadRoutes();
    }

    async startLaunchers(): Promise<void> {
        for (let i = 0; i < 5; i++) {
            this.launchers.set(i, {
                key: i,
                requests: 0,
                launch: await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=site-per-process']
                }).then(e => {
                    this.client.log(`Puppeteer ${i} iniciado com sucesso`, { tags: ['Puppeteer'], color: 'green' });
                    return e;
                })
            })
        };
    }

    checkRateLimit(req: Request, res: Response, next: NextFunction, useIP: boolean): Response | void {
        const IP = useIP ? req.headers['x-forwarded-for'] || req.socket.remoteAddress || null : (req.query.user as string).toLocaleLowerCase();

        const route = this.client.API.routes.get(req.path) as Route;

        if (!IP) return res.status(500).send({
            status: false,
            error: "IP não encontrado"
        });

        const rateLimit = this.rateLimit.get(IP as string) as RateLimit;

        if (!rateLimit) {
            const reqUuid = uuid();

            this.rateLimit.set(IP as string, {
                ip: IP as string,
                requests: new Collection<string, RequestData>().set(reqUuid, {
                    req,
                    uuid: reqUuid,
                    date: Date.now(),
                    timeout: setTimeout(() => {
                        this.rateLimit.get(IP as string)?.requests.delete(reqUuid);

                        const newLastRequest = this.rateLimit.get(IP as string)?.requests.first()

                        if (newLastRequest) {
                            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = newLastRequest.date;
                        } else {
                            this.rateLimit.delete(IP as string)
                        }
                    }, 15000)
                }),
                lastRequestDate: Date.now()
            });
            return next()
        }

        if (rateLimit.endAt) {
            const date = new Date(rateLimit.endAt);

            return res.status(429).send({
                status: false,
                error: "Você foi bloqueado de acessar as rotas da API (RATE LIMIT)",
                endAt: `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
            })
        };

        if (Date.now() - (rateLimit.lastRequestDate as number) < (useIP ? 1800 : route.timeout ? route.timeout : 1000)) {
            console.log("SETTING RATE LIMIT 1", rateLimit, route)
            const reqUuid = uuid();

            const pos = (this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData

            if (pos && pos.uuid) ((this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData).pos = reqUuid;

            this.rateLimit.get(IP as string)?.requests.set(reqUuid, {
                req,
                uuid: reqUuid,
                date: Date.now(),
                timeout: setTimeout(() => {
                    const findNow = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === reqUuid) as RequestData;

                    if (findNow && findNow.pos) {
                        const findPos = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === findNow.pos) as RequestData;

                        if (findPos) {
                            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = findPos.date;
                        } else {
                            this.rateLimit.delete(IP as string)
                        }
                    }

                    this.rateLimit.get(IP as string)?.requests.delete(reqUuid);

                    delete (this.rateLimit.get(IP as string) as RateLimit)?.startAt
                    delete (this.rateLimit.get(IP as string) as RateLimit)?.endAt
                }, 5000)
            });

            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = Date.now();

            (this.rateLimit.get(IP as string) as RateLimit).startAt = Date.now();
            (this.rateLimit.get(IP as string) as RateLimit).endAt = Date.now() + 5000;

            const date = new Date(Date.now() + 10000);

            return res.status(429).send({
                status: false,
                error: "Você foi bloqueado de acessar as rotas da API (RATE LIMIT)",
                endAt: `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
            });
        }

        if (rateLimit.requests.size >= 100) {
            console.log("SETTING RATE LIMIT 2", rateLimit, route)
            const reqUuid = uuid();

            const pos = (this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData

            if (pos && pos.uuid) ((this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData).pos = reqUuid;

            this.rateLimit.get(IP as string)?.requests.set(reqUuid, {
                req,
                uuid: reqUuid,
                date: Date.now(),
                timeout: setTimeout(() => {

                    const findNow = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === reqUuid) as RequestData;

                    if (findNow && findNow.pos) {
                        const findPos = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === findNow.pos) as RequestData;

                        if (findPos) {
                            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = findPos.date;
                        } else {
                            this.rateLimit.delete(IP as string)
                        }
                    }

                    this.rateLimit.get(IP as string)?.requests.delete(reqUuid)
                }, 20000)
            });

            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = Date.now();

            (this.rateLimit.get(IP as string) as RateLimit).startAt = Date.now();
            (this.rateLimit.get(IP as string) as RateLimit).endAt = Date.now() + 30000;

            (this.rateLimit.get(IP as string) as RateLimit).timeout = setTimeout(() => {
                delete (this.rateLimit.get(IP as string) as RateLimit).startAt

                delete (this.rateLimit.get(IP as string) as RateLimit).endAt
            }, 30000)

            const date = new Date(Date.now() + 30000);

            return res.status(429).send({
                status: false,
                error: "Você foi bloqueado de acessar as rotas da API (RATE LIMIT)",
                endAt: `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`,
                duration: '30s'
            });
        } else {

            const reqUuid = uuid();

            const pos = (this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData

            if (pos && pos.uuid) {
                console.log("EXSISTS POS");
                ((this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData).pos = reqUuid;
            }

            this.rateLimit.get(IP as string)?.requests.set(reqUuid, {
                req,
                uuid: reqUuid,
                date: Date.now(),
                timeout: setTimeout(() => {
                    const findNow = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === reqUuid) as RequestData;

                    if (findNow && findNow.pos) {
                        const findPos = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === findNow.pos) as RequestData;

                        if (findPos && findPos.uuid) {
                            console.log(this.rateLimit.get(IP as string)?.requests.size);
                            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = findPos.date;
                        } else {
                            console.log("SEM FUTURO KKKKK")
                            this.rateLimit.delete(IP as string)
                        }
                    }

                    this.rateLimit.get(IP as string)?.requests.delete(reqUuid)
                }, 20000),
            });

            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = Date.now();
        }

        const ARRAY_INTERVAL = [];

        const requests = this.rateLimit.get(IP as string)?.requests.map(r => r.date) as number[];

        for (let i = 0; i < requests.length; i++) {
            const now = requests[i];

            const next = requests[i + 1];

            if (next) {
                if (next > now) ARRAY_INTERVAL.push(next - now);

                if (next < now) ARRAY_INTERVAL.push(now - next);
            }
        };

        const MEDIA = ARRAY_INTERVAL.reduce((a, b) => a + b, 0) / ARRAY_INTERVAL.length;

        if ((useIP || !route.timeout) && requests.length >= 5 && MEDIA < 5000) {
            console.log("SETTING RATE LIMIT 3", rateLimit, route);

            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = Date.now();

            (this.rateLimit.get(IP as string) as RateLimit).startAt = Date.now();
            (this.rateLimit.get(IP as string) as RateLimit).endAt = Date.now() + 30000;

            (this.rateLimit.get(IP as string) as RateLimit).timeout = setTimeout(() => {
                delete (this.rateLimit.get(IP as string) as RateLimit).startAt

                delete (this.rateLimit.get(IP as string) as RateLimit).endAt
            }, 30000)

            const date = new Date(Date.now() + 30000);

            return res.status(429).send({
                status: false,
                error: "Você foi bloqueado de acessar as rotas da API (RATE LIMIT)",
                endAt: `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`,
                duration: '30s'
            });
        }

        next();
    }


    async postNotification({ user, title, body, data }: {
        user: WithId<User> | User,
        title: string,
        body: string,
        data?: NotificationData
    }): Promise<any> {
        user.user = user.user.toLowerCase();

        const dbUSER = await this.client.mongo.db("EMAKE").collection("users").findOne({ user: user.user })

        if (!dbUSER) return console.log("AUHSDUHASUDH", user);

        if (!dbUSER.postToken) return console.log("YEAYSYEDSYADY", user)

        const message = {
            notification: {
                title,
                body,
            },
            token: dbUSER.postToken,
            data: data
        } as admin.messaging.Message;

        return admin.messaging().send(message)
            .then(() => {
                this.client.log(`Mensagem enviada com sucesso para ${dbUSER.user}`, { tags: ['NOTIFICAÇÕES'], color: 'yellow' });
            })
            .catch(() => {
                this.client.log(`Não foi possível enviar mensagem para ${dbUSER.user}`, { tags: ['NOTIFICAÇÕES'], color: 'red' });

            });
    }
}