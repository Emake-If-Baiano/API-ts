import { Browser } from "puppeteer";

export default interface CustomBrowser {
    key: number,
    requests: number,
    launch: Browser,
}