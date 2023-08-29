import 'dotenv/config';

import Client from './client/Client';

const client = new Client();

client.login().then(() => {
    client.connectdatabase();

    client.loadModules();
});

process.on("uncaughtException", console.log)

process.on("unhandledRejection", console.log)