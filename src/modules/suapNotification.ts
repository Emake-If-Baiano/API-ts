import { Material, Module, Nota, Periodo, Turma, User } from "../Types";

import { Collection } from "@discordjs/collection";

import cron from "node-cron";

import Client from "../client/Client";

import { WithId } from "mongodb";

export default class suapNotification extends Module {
    constructor(client: Client) {
        super(client);
        this.client = client;
    }

    async start() {

        cron.schedule("0 0 * * *", () => {
            this.startSemestreLoader();
        });

        this.turmas();

        this.boletim();

        const users = await this.client.mongo.db("EMAKE").collection('users').find({}).toArray()

        const tokens = Object.values(users).map(u => u.postToken);

        //admin.messaging().sendMulticast({
        //    notification: {
        //        title: `NOVA ATUALIZAÇÃO DISPONÍVEL`,
        //        body:  `Atualize já na PLAY STORE!`
        //    },
        //    tokens
        //})
    };

    async startSemestreLoader() {
        return new Promise(async superRes => {
            const Users = await this.client.mongo.db("EMAKE").collection('users');

            const users = await Users.find({}).toArray()

            for (const user of Object.values(users)) {
                await new Promise(async resolve => {
                    const login = await this.client.modules.get('suap').login(user.user, user.password);

                    if (!login) {
                        return resolve(false);
                    };

                    user.token = login.access;

                    const periodos = await this.client.modules.get('suap').obterPeriodosLetivos(user.token)

                    if (!periodos) {
                        Users.updateOne({ user: user.user }, { $set: { token: login.access } })

                        console.log(`FAILED LOAD PERIODS FOR ` + user.user);

                        resolve(true)
                    } else {
                        semestre: for (const periodo of periodos.reverse()) {
                            const check = await new Promise(async resolve2 => {
                                const boletim = await this.client.modules.get('suap').getBoletim(user.token, periodo.ano_letivo, periodo.periodo_letivo);

                                if (boletim.length) {
                                    user.periodo = periodo;

                                    Users.updateOne({ user: user.user }, { $set: { token: login.access, periodo: user.periodo } })

                                    resolve2(true)
                                } else resolve2(false);
                            })

                            if (check) break semestre
                        }
                        resolve(true);
                    }
                });
            };

            console.log("SEMESTRE LOADER FINISHED!");

            superRes(true);
        })
    }

    async turmas() {
        const turmasCache: Collection<string, Turma> = new Collection();

        const func = async () => {
            const Users = await this.client.mongo.db("EMAKE").collection('users');

            const users = await Users.find({}).toArray()

            for (const user of Object.values(users)) {
                await new Promise(async resolve => {
                    let turmas = await this.client.modules.get('suap').minhasTurmas(user.token, user.ano_letivo, user.periodo_letivo);

                    if (!turmas) {
                        const login = await this.client.modules.get('suap').login(user.user, user.password);

                        if (!login) {
                            return resolve(false)
                        };

                        user.token = login.access;

                        Users.updateOne({ user: user.user }, { $set: { token: login.access } })

                        turmas = await this.client.modules.get('suap').minhasTurmas(login.access, user.ano_letivo, user.periodo_letivo).catch(() => false);

                        if (!turmas || !turmas.length) {

                            return resolve(false);
                        };
                    };
                    turmas?.forEach((t: Turma) => {
                        if (!turmasCache.get(t.id)) turmasCache.set(t.id, { ...t, usersIn: [user as any] })
                        else if (!(turmasCache.get(t.id) as Turma).usersIn.find((u: User) => u.user === user.user)) (turmasCache.get(t.id) as Turma).usersIn.push(user as any);
                    });

                    resolve(true)
                });
            };

            for (const tu of turmasCache.map((t) => t)) {

                await new Promise(async resolve => {
                    const turma = await this.client.modules.get('suap').getTurma(tu.usersIn[0].token, tu.id) as Turma;

                    if (!tu.materiais_de_aula?.length) {
                        tu.materiais_de_aula = [...turma.materiais_de_aula || [], { url: 'null' }];

                    }

                    const findMaterial = turma.materiais_de_aula?.filter((material: Material) => !tu.materiais_de_aula.find((m: Material) => m.url === material.url)) || [];

                    findMaterial.forEach((material: Material) => {
                        tu.usersIn.forEach((u: User) => {
                            if (u.user.toLowerCase() === '20211tdf29i0029') this.client.API.postNotification({
                                user: u,
                                title: `⚠️ ALERTA DE MATERIAIS ⚠️`,
                                body: `Foi postado um novo material na disciplina ${turma.componente_curricular.trim().toUpperCase()}`,
                            })
                        })
                    });

                    if (findMaterial.length) {
                        turmasCache.delete(tu.id);

                        console.log(turmasCache.get(tu.id));

                        turmasCache.set(turma.id, {
                            ...turma,
                            usersIn: tu.usersIn
                        });

                        resolve(true)
                    }
                })
            }
        }

        func();

        setInterval(() => {
            func();
        }, 60000);
    }

    async boletim() {

        const notasCache = new Map();

        const func = async () => {
            const Users = await this.client.mongo.db("EMAKE").collection('users');

            const users = await Users.find({}).toArray() as Array<WithId<User>>;

            for (const user of users) {

                await new Promise(async resolve => {

                    if (!user.periodo) return resolve(false);

                    let notas = await this.client.modules.get('suap').getBoletim(user.token, (user.periodo as Periodo).ano_letivo, (user.periodo as Periodo).periodo_letivo);

                    if (!notas) {
                        const login = await this.client.modules.get('suap').login(user.user, user.password);

                        if (!login) {

                            return resolve(false)
                        };

                        user.token = login.access;

                        Users.updateOne({ user: user.user }, { $set: { token: login.access } })

                        notas = await this.client.modules.get('suap').getBoletim(login.access, (user.periodo as Periodo).ano_letivo, (user.periodo as Periodo).periodo_letivo);

                        if (!notas) {

                            return resolve(false);
                        }
                    };

                    notas = notas.filter((n: Nota) => n.situacao === 'Cursando');

                    const last = notasCache.get(user.user);

                    if (last) {
                        last.forEach((nota: Nota) => {

                            if (!nota) {
                                notasCache.delete(user.user);

                                return
                            };

                            if (nota.nota_etapa_1.nota != notas.find((n: Nota) => n.codigo_diario == nota.codigo_diario).nota_etapa_1.nota)
                                this.client.API.postNotification({
                                    user,
                                    title: `⚠️ ALERTA DE BOLETIM ⚠️`,
                                    body: `A nota da disciplina ${nota.disciplina} foi alterada de ${nota.nota_etapa_1.nota || 0} para ${notas.find((n: Nota) => n.codigo_diario == nota.codigo_diario).nota_etapa_1.nota || 0}.`,
                                })

                            if (nota.nota_etapa_2.nota != notas.find((n: Nota) => n.codigo_diario == nota.codigo_diario).nota_etapa_2.nota)
                                this.client.API.postNotification({
                                    user,
                                    title: `⚠️ ALERTA DE BOLETIM ⚠️`,
                                    body: `A nota da disciplina ${nota.disciplina} foi alterada de ${nota.nota_etapa_2.nota || 0} para ${notas.find((n: Nota) => n.codigo_diario == nota.codigo_diario).nota_etapa_2.nota || 0}.`,
                                })

                            if (nota.nota_avaliacao_final?.nota != notas.find((n: Nota) => n.codigo_diario == nota.codigo_diario).nota_avaliacao_final?.nota)
                                this.client.API.postNotification({
                                    user,
                                    title: `⚠️ ALERTA DE BOLETIM ⚠️`,
                                    body: `A nota da avaliação final da ${nota.disciplina} foi alterada de ${nota.nota_etapa_2.nota || 0} para ${notas.find((n: Nota) => n.codigo_diario == nota.codigo_diario).nota_etapa_2.nota || 0}.`,
                                })

                            if (nota.numero_faltas < notas.find((n: Nota) => n.codigo_diario == nota.codigo_diario).numero_faltas) {
                                this.client.API.postNotification({
                                    user,
                                    title: `⚠️ ALERTA DE FALTAS ⚠️`,
                                    body: `Foram adicionadas ${notas.find((n: Nota) => n.codigo_diario == nota.codigo_diario).numero_faltas - nota.numero_faltas} faltas na disciplina ${nota.disciplina}.`,
                                })
                            }
                        });

                        notasCache.set(user.user, notas);

                    } else notasCache.set(user.user, notas);

                    resolve(true);
                })
            }
        };

        func();

        setInterval(() => {
            func();
        }, 60000);
    }
}