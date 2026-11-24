const EventEmitter = require('events');
const WebSocket = require('ws');

const fatalCodes = new Set([4004, 4010, 4011, 4012, 4013, 4014]);
const resetCodes = new Set([4003, 4005, 4007, 4009]);

class Gateway extends EventEmitter {
    /** @param {GatewayOptions} options */
    constructor(options) {
        super();

        this.token = options.token;
        this.browser = options.browser;
        this.device = options.device;
        this.forceOnline = options.forceOnline ?? false;
        this.label = options.label || this.browser;

        /** @type {WebSocket | null} */
        this.ws = null;
        /** @type {NodeJS.Timeout | null} */
        this.heartbeatTimeout = null;
        /** @type {NodeJS.Timeout | null} */
        this.heartbeatInterval = null;
        /** @type {NodeJS.Timeout | null} */
        this.reconnectTimeout = null;
        this.heartbeatAcked = true;
        /** @type {number | null} */
        this.sequence = null;
        /** @type {string | null} */
        this.sessionId = null;
        /** @type {string | null} */
        this.resumeUrl = null;
        this.attempts = 0;
        this.destroyed = false;
    }

    connect() {
        if (this.destroyed) return;
        this.cleanup();

        const url = this.resumeUrl || 'wss://gateway.discord.gg/?v=9&encoding=json';
        this.ws = new WebSocket(url, {
            headers: {
                Origin: 'https://discord.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            }
        });

        this.ws.on('message', (data) => this.onMessage(data.toString()));
        this.ws.on('close', (code) => this.onClose(code));
        this.ws.on('error', (err) => {
            if (!this.destroyed && this.ws?.readyState === WebSocket.OPEN) 
                console.error(`[${this.label}] error: ${err.message}`);
        });
    }

    cleanup() {
        this.stopHeartbeat();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.on('error', () => {});
            try { this.ws.terminate(); } catch {}

            this.ws = null;
        }
    }

    destroy() {
        this.destroyed = true;
        this.cleanup();
    }

    /**
     * @param {number} op
     * @param {unknown} [d]
     */
    send(op, d) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this.ws.send(JSON.stringify({ op, d }));
    }

    /** @param {number} intervalMs */
    startHeartbeat(intervalMs) {
        this.stopHeartbeat();
        this.heartbeatAcked = true;

        const jitter = Math.random() * intervalMs;
        this.heartbeatTimeout = setTimeout(() => {
            this.sendHeartbeat();

            this.heartbeatInterval = setInterval(() => {
                if (!this.heartbeatAcked) return this.reconnect(1000);

                this.sendHeartbeat();
            }, intervalMs);
        }, jitter);
    }

    stopHeartbeat() {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    sendHeartbeat() {
        this.heartbeatAcked = false;
        this.send(1, this.sequence);
    }

    identify() {
        this.send(2, {
            token: this.token,
            capabilities: 16381,
            properties: {
                os: 'Windows',
                browser: this.browser,
                device: this.device,
                system_locale: 'en-US',
                browser_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                browser_version: '131.0.0.0',
                os_version: '10',
                referrer: '',
                referring_domain: '',
                referrer_current: '',
                referring_domain_current: '',
                release_channel: 'stable',
                client_build_number: 365026,
                client_event_source: null
            },
            presence: {
                status: this.forceOnline ? 'online' : 'online',
                since: 0,
                activities: [],
                afk: false
            },
            compress: false,
            client_state: {
                guild_hashes: {},
                highest_last_message_id: '0',
                read_state_version: 0,
                user_guild_settings_version: -1,
                user_settings_version: -1,
                private_channels_version: '0'
            }
        });
    }

    resume() {
        this.send(6, {
            token: this.token,
            session_id: this.sessionId,
            seq: this.sequence
        });
    }

    /** @param {string} raw */
    onMessage(raw) {
        /** @type {GatewayPayload} */
        let payload;
        try { payload = JSON.parse(raw); } catch { return; }

        if (payload.s !== null) this.sequence = payload.s;

        switch (payload.op) {
            case 10:
                this.startHeartbeat(payload.d.heartbeat_interval);
                if (this.sessionId) this.resume();
                else this.identify();
                break;
            case 11:
                this.heartbeatAcked = true;
                break;
            case 1:
                this.sendHeartbeat();
                break;
            case 7:
                this.reconnect(0);
                break;
            case 9:
                if (!payload.d) {
                    this.sessionId = null;
                    this.resumeUrl = null;
                    this.sequence = null;
                }
                this.reconnect(1000 + Math.random() * 4000);
                break;
            case 0:
                this.onDispatch(payload);
                break;
        }
    }

    /** @param {GatewayPayload} payload */
    onDispatch(payload) {
        if (!payload.t) return;

        if (payload.t === 'READY') {
            this.sessionId = payload.d.session_id;
            this.resumeUrl = payload.d.resume_gateway_url;
            this.attempts = 0;
            console.log(`spoofed as ${this.browser} on ${this.device} | ${payload.d.user.username}`);
        }

        if (payload.t === 'RESUMED') this.attempts = 0;
        this.emit(payload.t, payload.d);
    }

    /** @param {number} code */
    onClose(code) {
        this.stopHeartbeat();
        if (this.destroyed) return;
        if (fatalCodes.has(code)) return console.error(`[${this.label}] fatal error (${code}), stopping`);

        if (resetCodes.has(code)) {
            this.sessionId = null;
            this.resumeUrl = null;
            this.sequence = null;
        }

        const delay = Math.min(1000 * (2 ** this.attempts++), 30000);
        this.reconnect(delay);
    }

    /** @param {number} [delay] */
    reconnect(delay = 1000) {
        if (this.destroyed) return;
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, delay);
    }
}

module.exports = Gateway;
