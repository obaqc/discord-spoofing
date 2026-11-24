const fs = require('fs');
const path = require('path');

const configPath = path.resolve(process.cwd(), 'src', 'storage', 'config.json');

/** @returns {AppConfig} */
function loadConfig() {
    if (!fs.existsSync(configPath)) throw new Error('storage/config.json not found');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (typeof config.token === 'string' && !config.tokens) config.tokens = [config.token];
    if (!Array.isArray(config.tokens) || !config.tokens.length) throw new Error('No tokens configured in storage/config.json');
    if (typeof config.forceOnlineMode !== 'boolean') config.forceOnlineMode = false;
    if (!config.devices || typeof config.devices !== 'object') throw new Error('Missing devices in storage/config.json');

    return config;
}

module.exports = { config: loadConfig() };
