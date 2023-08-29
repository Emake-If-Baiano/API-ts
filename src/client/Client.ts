import { readdirSync } from "fs";

import chalk from 'chalk';

import lodash from 'lodash';

import { MongoClient } from 'mongodb';

import { Collection } from '@discordjs/collection';

import firebase from 'firebase';

import API from "../API/API";

interface LogOptions {
    tags?: Array<string>;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    reversed?: boolean;
    bgColor?: boolean;
    color?: string;
};

export default class Client {

    modules: Collection<string, any>

    firebase?: firebase.database.Database;

    mongo: MongoClient

    API: API;

    version: number;

    REQUEST_TIMEOUT_MS: number

    constructor() {
        this.modules = new Collection();

        this.mongo = new MongoClient(process.env.MONGO_URL as string);

        this.API = new API(this);

        this.API.start();

        this.version = 2;

        this.REQUEST_TIMEOUT_MS = 30000;
    }

    log(
        message: string,
        {
            tags: [...tags] = ['Client'],
            bold = false,
            italic = false,
            underline = false,
            reversed = false,
            bgColor = false,
            color = 'white'
        } = {} as LogOptions
    ) {
        const colorFunction = lodash.get(
            chalk,
            [bold, italic, underline, reversed, bgColor, color].filter(Boolean).join('.')
        )

        console.log(...tags.map(t => chalk.cyan(`[${t}]`)), colorFunction(message))
    }

    async login() {
        return this;
    };

    async loadModules() {
        const modules = readdirSync('build/modules/');

        for (const file of modules) {
            const module = require(`../modules/${file}`);

            this.log(`[MODULES] - Módulo ${file} carregado`, { color: 'yellow' });

            const m = new module.default(this);

            await m.start();

            this.modules.set(m.name, m);
        }
    }

    async connectdatabase() {
        firebase.initializeApp({
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID,
            measurementId: process.env.FIREBASE_MESASURE_ID
        });

        this.firebase = firebase.database();

        this.mongo.connect().then(async () => {
            this.log(`[Database]- Banco de dados iniciado com sucesso.`, { tags: ['Banco de dados'], color: 'green' });
        }).catch(err => {
            this.log(`[Database] - Erro ao iniciar o banco de dados.`, { tags: ['Banco de dados'], color: 'red' });

            console.log(err)
        })

        return this.log(`[Database] - Banco de dados iniciado com sucesso.`, { tags: ['Banco de dados'], color: 'green' })
    };
}