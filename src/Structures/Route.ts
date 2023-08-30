import { NextFunction, Request, Response } from "express";
import Client from "../client/Client";

export default abstract class Route {
    path: string;
    method: string;
    client: Client;

    abstract name: string;

    requiredAuth?: boolean;

    constructor(path: string, method: string, client: Client) {
        this.path = path;
        this.method = method;

        this.client = client;
    }

    abstract execute(req: Request, res: Response, next?: NextFunction): Promise<Response>;

    async createTimer(res: Response): Promise<NodeJS.Timeout> {
        return setTimeout(() => {
            res.status(500).send({
                status: false,
                message: 'Internal Server Error'
            }).end();
        }, this.client.REQUEST_TIMEOUT_MS)
    };

    clearTimer(timer: NodeJS.Timeout): void {
        clearTimeout(timer);
    }
}