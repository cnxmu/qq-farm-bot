const crypto = require('node:crypto');

function createAdminAuthService(options = {}) {
    const {
        sessionStore,
        tokenTtlMs,
        checkLoginLock,
        recordLoginFailure,
        clearLoginAttempts,
    } = options;

    if (!sessionStore) throw new Error('sessionStore is required');

    const ttlMs = Math.max(60 * 1000, Number(tokenTtlMs) || (24 * 60 * 60 * 1000));

    function getTokenMeta(rawToken) {
        const token = String(rawToken || '').trim();
        if (!token) return null;
        const meta = sessionStore.get(token);
        if (!meta) return null;
        if (meta.expiresAt <= Date.now()) {
            sessionStore.delete(token);
            return null;
        }
        return meta;
    }

    function issueToken() {
        const token = crypto.randomBytes(24).toString('hex');
        const now = Date.now();
        sessionStore.set(token, { issuedAt: now, expiresAt: now + ttlMs });
        return token;
    }

    function deleteToken(rawToken) {
        const token = String(rawToken || '').trim();
        if (!token) return;
        sessionStore.delete(token);
    }

    function cleanupExpiredTokens() {
        const now = Date.now();
        for (const [token, meta] of sessionStore.entries()) {
            if (!meta || meta.expiresAt <= now) sessionStore.delete(token);
        }
    }

    function startCleanupTimer() {
        return setInterval(cleanupExpiredTokens, Math.min(5 * 60 * 1000, ttlMs));
    }

    function ensureNotLocked(identifier) {
        if (typeof checkLoginLock !== 'function') return;
        checkLoginLock(identifier);
    }

    function recordFailure(identifier) {
        if (typeof recordLoginFailure !== 'function') return { locked: false, attemptsLeft: 0, message: '' };
        return recordLoginFailure(identifier);
    }

    function clearAttempts(identifier) {
        if (typeof clearLoginAttempts !== 'function') return;
        clearLoginAttempts(identifier);
    }

    return {
        getTokenMeta,
        issueToken,
        deleteToken,
        startCleanupTimer,
        ensureNotLocked,
        recordFailure,
        clearAttempts,
    };
}

module.exports = {
    createAdminAuthService,
};
