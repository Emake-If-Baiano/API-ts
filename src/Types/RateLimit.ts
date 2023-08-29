import { Request } from "express";

interface RequestData {
    req: Request;
    uuid: string
    date: number
}
export default interface RateLimit {
    ip: string;
    requests: RequestData[]
    startAt?: number
    endAt?: number;
    lastRequestDate?: number
}