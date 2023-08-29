import axios from "axios";

import { Module } from "../Types";

import Client from "../client/Client";

export default class SUAPModule extends Module {
    defaultURL: string;

    constructor(client: Client) {
        super(client);

        this.name = 'suap';

        this.client = client;

        this.defaultURL = 'https://suap.ifbaiano.edu.br/api/v2';
    }

    async start() {
        return true;
    }

    async login(user: string, password: string) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            instance.post(
                '/autenticacao/token/?format=json',
                {
                    username: user.toLowerCase(),
                    password: password
                }).then(res => {
                    resolve(res.data);
                }, (err) => {
                    resolve(false);
                })
        })
    };

    async refreshToken(refresh: string) {

        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            instance.post(
                '/autenticacao/token/refresh/',
                {
                    refresh
                }).then(res => {
                    console.log(res.data.refresh)
                    resolve(res.data);
                }, (err) => {
                    console.log(err)
                    resolve(false);
                })
        })
    }

    async meusDados(token: string) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            instance.get("/minhas-informacoes/meus-dados/").then(e => {
                resolve(e.data)
            }, (err) => resolve(false))
        })
    }

    async getBoletim(token: string, ano = 2022, semestre = 1) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            instance.get(`/minhas-informacoes/boletim/${ano}/${semestre}/`).then(e => {

                resolve(e.data)
            }, (err) => resolve(false))
        })
    }

    async minhasTurmas(token: string, ano = 2022, semestre = 1) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            instance.get(`/minhas-informacoes/turmas-virtuais/${ano}/${semestre}/`).then(e => {
                resolve(e.data)
            }, (err) => resolve(false))
        })
    }

    async getTurma(token: string, id: string) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            instance.get(`/minhas-informacoes/turma-virtual/${id}`).then(e => {
                resolve(e.data)
            }, (err) => resolve(false))
        })
    }

    async obterPeriodosLetivos(token: string) {
        return new Promise(resolve => {
            const instance = axios.create({
                baseURL: 'https://suap.ifbaiano.edu.br/api/v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            instance.get(`minhas-informacoes/meus-periodos-letivos/`).then(e => {
                resolve(e.data)
            }, (err) => {
                resolve(false);

                console.log(err)
            })
        })
    }
}