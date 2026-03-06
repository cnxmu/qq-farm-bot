const process = require('node:process');
const { getDataFile } = require('../config/runtime-paths');
const { readJsonFile, writeJsonFileAtomic } = require('./json-db');

function normalizeTokenMap(input) {
    const src = (input && typeof input === 'object') ? input : {};
    const out = {};
    for (const [token, meta] of Object.entries(src)) {
        if (!token) continue;
        const issuedAt = Number(meta && meta.issuedAt);
        const expiresAt = Number(meta && meta.expiresAt);
        if (!Number.isFinite(expiresAt) || expiresAt <= 0) continue;
        out[token] = {
            issuedAt: Number.isFinite(issuedAt) ? issuedAt : Date.now(),
            expiresAt,
        };
    }
    return out;
}

function createMemorySessionStore() {
    const tokens = new Map();
    return {
        get(token) {
            return tokens.get(token) || null;
        },
        set(token, meta) {
            tokens.set(token, meta);
        },
        delete(token) {
            tokens.delete(token);
        },
        entries() {
            return tokens.entries();
        },
    };
}

function createFileSessionStore(options = {}) {
    const filePath = options.filePath || getDataFile('admin-sessions.json');
    const cache = new Map(Object.entries(normalizeTokenMap(readJsonFile(filePath, () => ({})))));

    const persist = () => {
        const data = Object.fromEntries(cache.entries());
        writeJsonFileAtomic(filePath, data);
    };

    return {
        get(token) {
            return cache.get(token) || null;
        },
        set(token, meta) {
            cache.set(token, meta);
            persist();
        },
        delete(token) {
            if (!cache.has(token)) return;
            cache.delete(token);
            persist();
        },
        entries() {
            return cache.entries();
        },
    };
}

function createSessionStore(options = {}) {
    const modeRaw = options.mode || process.env.ADMIN_SESSION_STORE || 'memory';
    const mode = String(modeRaw).trim().toLowerCase();
    if (mode === 'file') return createFileSessionStore(options);
    return createMemorySessionStore();
}

module.exports = {
    createSessionStore,
};
