interface DeviceConfig {
    name: string;
    spoof: boolean;
}

interface AppConfig {
    tokens: string[];
    forceOnlineMode: boolean;
    devices: Record<string, DeviceConfig>;
}

interface GatewayOptions {
    token: string;
    browser: string;
    device: string;
    forceOnline?: boolean;
    label?: string;
}

interface GatewayPayload {
    op: number;
    d: any;
    s: number | null;
    t: string | null;
}

interface GatewayPresence {
    status: 'online' | 'idle' | 'dnd' | 'invisible';
    since: number;
    activities: unknown[];
    afk: boolean;
}

interface GatewayProperties {
    os: string;
    browser: string;
    device: string;
    system_locale: string;
    browser_user_agent: string;
    browser_version: string;
    os_version: string;
    referrer: string;
    referring_domain: string;
    referrer_current: string;
    referring_domain_current: string;
    release_channel: string;
    client_build_number: number;
    client_event_source: null;
}

interface GatewayClientState {
    guild_hashes: Record<string, never>;
    highest_last_message_id: string;
    read_state_version: number;
    user_guild_settings_version: number;
    user_settings_version: number;
    private_channels_version: string;
}

interface GatewayIdentify {
    token: string;
    capabilities: number;
    properties: GatewayProperties;
    presence: GatewayPresence;
    compress: boolean;
    client_state: GatewayClientState;
}

interface GatewayResume {
    token: string;
    session_id: string;
    seq: number | null;
}
