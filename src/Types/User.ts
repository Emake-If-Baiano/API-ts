import Message from "./Message";


export default interface User {
    id: string,
    name?: string,
    iconURL: string,
    messages: Array<Message>,
    postToken: string,
    user: string,
    password: string,
    notas: boolean,
    materiais: boolean,
    faltas: boolean,
    admin: boolean,
    token: string,
    periodo?: {
        ano_letivo: number,
        periodo_letivo: number
    }
    support?: boolean
}