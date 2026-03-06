function registerQrRoutes(options = {}) {
    const {
        app,
        authRequired,
        MiniProgramLoginSession,
        rateLimitMiddleware,
    } = options;

    if (!app || !authRequired || !MiniProgramLoginSession) {
        throw new Error('registerQrRoutes missing required dependencies');
    }

    app.use('/api/qr', authRequired);
    app.use('/api/qr', rateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 20,
        keyGenerator: (req) => `qr:${req.ip}`,
    }));

    app.post('/api/qr/create', async (req, res) => {
        try {
            const result = await MiniProgramLoginSession.requestLoginCode();
            res.json({ ok: true, data: result });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.post('/api/qr/check', async (req, res) => {
        const { code } = req.body || {};
        if (!code) {
            return res.status(400).json({ ok: false, error: 'Missing code' });
        }

        try {
            const result = await MiniProgramLoginSession.queryStatus(code);

            if (result.status === 'OK') {
                const ticket = result.ticket;
                const uin = result.uin || '';
                const nickname = result.nickname || '';
                const appid = '1112386029';

                const authCode = await MiniProgramLoginSession.getAuthCode(ticket, appid);

                let avatar = '';
                if (uin) {
                    avatar = `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=640`;
                }

                return res.json({ ok: true, data: { status: 'OK', code: authCode, uin, avatar, nickname } });
            }

            if (result.status === 'Used') {
                return res.json({ ok: true, data: { status: 'Used' } });
            }

            if (result.status === 'Wait') {
                return res.json({ ok: true, data: { status: 'Wait' } });
            }

            return res.json({ ok: true, data: { status: 'Error', error: result.msg } });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
}

module.exports = {
    registerQrRoutes,
};
