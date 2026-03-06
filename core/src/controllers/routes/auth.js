function registerAuthRoutes(options = {}) {
    const {
        app,
        authRequired,
        authService,
        store,
        CONFIG,
        getIO,
        verifyPassword,
        hashPassword,
        checkPasswordStrength,
        SECURITY_CONFIG,
    } = options;

    if (!app || !authService) throw new Error('registerAuthRoutes missing required dependencies');

    app.post('/api/login', async (req, res) => {
        const { password } = req.body || {};
        const requestIp = req.ip;

        try {
            authService.ensureNotLocked(requestIp);
        } catch (error) {
            return res.status(429).json({ ok: false, error: error.message });
        }

        const input = String(password || '');
        const storedHash = store.getAdminPasswordHash ? store.getAdminPasswordHash() : '';
        const envAdminPassword = String(CONFIG.adminPassword || '');
        let ok = false;

        if (storedHash) {
            ok = await verifyPassword(input, storedHash);
        } else {
            if (!envAdminPassword) {
                return res.status(503).json({ ok: false, error: '管理员密码未初始化，请先设置 ADMIN_PASSWORD' });
            }
            ok = input === envAdminPassword;
        }

        if (!ok) {
            const failed = authService.recordFailure(requestIp);
            if (failed && failed.locked) {
                return res.status(429).json({ ok: false, error: failed.message || '登录尝试过多，请稍后重试' });
            }
            return res.status(401).json({ ok: false, error: 'Invalid password' });
        }

        authService.clearAttempts(requestIp);
        const token = authService.issueToken();
        res.json({ ok: true, data: { token } });
    });

    app.use('/api', (req, res, next) => {
        if (req.path === '/login' || req.path === '/auth/validate') return next();
        return authRequired(req, res, next);
    });

    app.post('/api/admin/change-password', async (req, res) => {
        const body = req.body || {};
        const oldPassword = String(body.oldPassword || '');
        const newPassword = String(body.newPassword || '');
        const strength = checkPasswordStrength(newPassword);
        if (!strength.valid) {
            return res.status(400).json({ ok: false, error: strength.feedback[0] || '新密码不符合要求', feedback: strength.feedback });
        }
        if (newPassword.length > SECURITY_CONFIG.maxPasswordLength) {
            return res.status(400).json({ ok: false, error: `新密码长度不能超过 ${SECURITY_CONFIG.maxPasswordLength} 位` });
        }
        const storedHash = store.getAdminPasswordHash ? store.getAdminPasswordHash() : '';
        const ok = storedHash
            ? await verifyPassword(oldPassword, storedHash)
            : oldPassword === String(CONFIG.adminPassword || '');
        if (!ok) {
            return res.status(400).json({ ok: false, error: '原密码错误' });
        }
        const nextHash = await hashPassword(newPassword);
        if (store.setAdminPasswordHash) {
            store.setAdminPasswordHash(nextHash);
        }
        res.json({ ok: true });
    });

    app.get('/api/auth/validate', (req, res) => {
        const token = String(req.headers['x-admin-token'] || '').trim();
        const valid = !!token && !!authService.getTokenMeta(token);
        if (!valid) {
            return res.status(401).json({ ok: false, data: { valid: false }, error: 'Unauthorized' });
        }
        res.json({ ok: true, data: { valid: true } });
    });

    app.post('/api/logout', (req, res) => {
        const token = req.adminToken;
        if (token) {
            authService.deleteToken(token);
            const io = typeof getIO === 'function' ? getIO() : null;
            if (io) {
                for (const socket of io.sockets.sockets.values()) {
                    if (String(socket.data.adminToken || '') === String(token)) {
                        socket.disconnect(true);
                    }
                }
            }
        }
        res.json({ ok: true });
    });
}

module.exports = {
    registerAuthRoutes,
};
