const { config } = require('./utils/config');
const Gateway = require('./Classes/Gateway');

/** @type {Set<InstanceType<typeof Gateway>>} */
const clients = new Set();
const enabledDevices = Object.entries(config.devices).filter(([, device]) => device.spoof);

for (const [tokenIndex, token] of config.tokens.entries()) {
    const tokenLabel = `…${token.slice(-6)}`;

    for (const [deviceIndex, [browser, device]] of enabledDevices.entries()) {
        const delay = (tokenIndex * enabledDevices.length + deviceIndex) * 1000;

        setTimeout(() => {
            const client = new Gateway({ token, browser, device: device.name, forceOnline: config.forceOnlineMode, label: `${tokenLabel}/${browser}` });

            client.connect();
            clients.add(client);
        }, delay);
    }
}

process.once('SIGINT', () => {
    clients.forEach((client) => client.destroy());
    process.exit(0);
});
