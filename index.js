// @ts-check

const { Client } = require('discord.js-selfbot-v13');
const config = require('./config.json');

/** @type {Set<import('discord.js-selfbot-v13').Client>} */
const clients = new Set();

for (const [browser, device] of Object.entries(config.devices)) {
    if (!device.spoof) continue;

    /** @type {import('discord.js-selfbot-v13').Client} */
    const client = new Client({ ws: { properties: { browser } } });

    client.once('ready', () => {
        if (config.forceOnlineMode) client.user?.setStatus('online');

        console.log(`spoofed as ${browser} on ${device.name} | ${client.user?.username}`);
    });

    client.login(config.token).catch(console.error);
    clients.add(client);
}

process.once('SIGINT', () => {
    clients.forEach(client => client.destroy());
    // we destroy each client, due to it keeping on the gateway WSS for a bit after.
    
    process.exit(0);
});