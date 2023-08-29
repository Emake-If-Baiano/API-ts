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

    constructor(client: Client) {
        super(client);

        this.client = client;

        this.name = 'api';

        this.launchers = new Collection();

        this.rateLimit = new Collection();
    }

    get launch(): CustomBrowser {
        return this.launchers.sort((a, b) => a.requests - b.requests).first() as CustomBrowser;
    }

    async loadRoutes() {
        const routes = fs.readdirSync('build/API/Routes');

        for (const route of routes) {
            const Route = require(`./Routes/${route}`).default;

            const routeInstance = new Route(this.client) as Route;

            this.client.log(`Rota ${routeInstance.name} carregada.`, { tags: ['ROTAS'], color: 'magenta' });

            (app as any)[routeInstance.method](routeInstance.path, async (req: Request, res: Response, next: NextFunction) => {
                try {
                    await routeInstance.execute(req, res, next);
                } catch (err) {
                    res.status(500).send({
                        status: false,
                        error: (err as Error).message
                    })
                }
            })
        }
    }
    async start(): Promise<void> {

        this.client.API = this;

        this.startLaunchers();

        app.all('*', (req: Request, res: Response, next: NextFunction) => {
            this.checkRateLimit(req, res, next);
        });

        const server = https.createServer({
            key: fs.readFileSync('/home/container/key.pem'),
            cert: fs.readFileSync('/home/container/cert.pem')
        }, app);

        const PORT = 25500;

        server.listen(PORT, () => {
            this.client.log(`API iniciada na porta ${PORT}`, { tags: ['API'], color: 'green' });
        });

        this.loadRoutes();
    }

    async startLaunchers(): Promise<void> {
        for (let i = 0; i < 4; i++) {
            this.launchers.set(i, {
                key: i,
                requests: 0,
                launch: await puppeteer.launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=site-per-process'],
                }).then(e => {

                    this.client.log(`Puppeteer ${i} iniciado com sucesso`, { tags: ['Puppeteer'], color: 'green' });
                    return e;
                })
            })
        };
    }

    checkRateLimit(req: Request, res: Response, next: NextFunction): Response | void {
        const IP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        if (!IP) return res.status(500).send({
            status: false,
            error: "IP não encontrado"
        });

        const rateLimit = this.rateLimit.get(IP as string) as RateLimit;

        if (!rateLimit) {
            console.log("SEM RATE LIMIT")
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

        if (Date.now() - (rateLimit.lastRequestDate as number) < 1800) {
            console.log("SETTING RATE LIMIT 1", rateLimit)
            const reqUuid = uuid();

            const pos = (this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData

            if (pos) ((this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData).pos = reqUuid;

            this.rateLimit.get(IP as string)?.requests.set(reqUuid, {
                req,
                uuid: reqUuid,
                date: Date.now(),
                timeout: setTimeout(() => {
                    const findNow = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === reqUuid) as RequestData;

                    if (findNow.pos) {
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
                }, 5000),
                pos: pos ? pos.uuid : undefined
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

        if (rateLimit.requests.size >= 10) {
            console.log("SETTING RATE LIMIT 2", rateLimit)
            const reqUuid = uuid();

            const pos = (this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData

            if (pos) ((this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData).pos = reqUuid;

            this.rateLimit.get(IP as string)?.requests.set(reqUuid, {
                req,
                uuid: reqUuid,
                date: Date.now(),
                timeout: setTimeout(() => {

                    const findNow = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === reqUuid) as RequestData;

                    if (findNow.pos) {
                        const findPos = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === findNow.pos) as RequestData;

                        if (findPos) {
                            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = findPos.date;
                        } else {
                            this.rateLimit.delete(IP as string)
                        }
                    }

                    this.rateLimit.get(IP as string)?.requests.delete(reqUuid)
                }, 10000)
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

            if (pos) ((this.rateLimit.get(IP as string) as RateLimit).requests.last() as RequestData).pos = reqUuid;

            this.rateLimit.get(IP as string)?.requests.set(reqUuid, {
                req,
                uuid: reqUuid,
                date: Date.now(),
                timeout: setTimeout(() => {
                    const findNow = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === reqUuid) as RequestData;

                    if (findNow.pos) {
                        const findPos = this.rateLimit.get(IP as string)?.requests.find(e => e.uuid === findNow.pos) as RequestData;

                        if (findPos) {
                            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = findPos.date;
                        } else {
                            this.rateLimit.delete(IP as string)
                        }
                    };

                    this.rateLimit.get(IP as string)?.requests.delete(reqUuid)
                }, 10000),
            });

            (this.rateLimit.get(IP as string) as RateLimit).lastRequestDate = Date.now();
        }

        next();
    }

    async postNotification({ user, title, body, data }: {
        user: WithId<User> | User,
        title: string,
        body: string,
        data?: NotificationData
    }): Promise<boolean> {
        return true;

        // user.user = user.user.toLowerCase();

        // const dbUSER = await this.client.mongo.db("EMAKE").collection("users").findOne({ user: user.user })

        // if (!dbUSER) return console.log("AUHSDUHASUDH", user);

        // if (!dbUSER.postToken) return console.log("YEAYSYEDSYADY", user)

        // const message = {
        //     notification: {
        //         title,
        //         body,
        //     },
        //     token: dbUSER.postToken,
        //     data: data
        // } as admin.messaging.Message;

        // return admin.messaging().send(message)
        //     .then(() => {
        //         this.client.log(`Mensagem enviada com sucesso para ${dbUSER.user}`, { tags: ['NOTIFICAÇÕES'], color: 'yellow' });
        //     })
        //     .catch(() => {
        //         this.client.log(`Não foi possível enviar mensagem para ${dbUSER.user}`, { tags: ['NOTIFICAÇÕES'], color: 'red' });

        //     });
    }
}