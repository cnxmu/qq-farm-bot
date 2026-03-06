/**
 * 推送接口封装（基于 pushoo）
 */

const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const process = require('node:process');
const pushoo = require('pushoo').default;

const dnsLookup = dns.promises.lookup;
const PRIVATE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function parseHostAllowList() {
    return new Set(
        String(process.env.WEBHOOK_ALLOWED_HOSTS || '')
            .split(',')
            .map(v => v.trim().toLowerCase())
            .filter(Boolean),
    );
}

function isPrivateIPv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
}

function isPrivateIPv6(ip) {
    const normalized = String(ip || '').toLowerCase();
    return normalized === '::1'
        || normalized === '::'
        || normalized.startsWith('fc')
        || normalized.startsWith('fd')
        || normalized.startsWith('fe80')
        || normalized.startsWith('::ffff:127.')
        || normalized.startsWith('::ffff:10.')
        || normalized.startsWith('::ffff:192.168.')
        || /^::ffff:172\.(?:1[6-9]|2\d|3[01])\./.test(normalized);
}

function assertPublicIp(ip) {
    const family = net.isIP(ip);
    if (!family) throw new Error('Webhook 目标域名解析失败');
    if (family === 4 && isPrivateIPv4(ip)) throw new Error('Webhook 不允许内网/回环地址');
    if (family === 6 && isPrivateIPv6(ip)) throw new Error('Webhook 不允许内网/回环地址');
}

async function assertSafeWebhookUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('Webhook 地址格式无效');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Webhook 仅支持 HTTP/HTTPS 协议');
    }

    const hostname = String(parsed.hostname || '').toLowerCase();
    if (!hostname) throw new Error('Webhook 地址缺少主机名');
    if (PRIVATE_HOSTS.has(hostname)) {
        throw new Error('Webhook 不允许本地地址');
    }

    const allowedHosts = parseHostAllowList();
    if (allowedHosts.size > 0 && !allowedHosts.has(hostname)) {
        throw new Error('Webhook 目标域名不在白名单中');
    }

    if (net.isIP(hostname)) {
        assertPublicIp(hostname);
        return;
    }

    const records = await dnsLookup(hostname, { all: true });
    if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Webhook 目标域名无法解析');
    }
    for (const record of records) {
        assertPublicIp(record.address);
    }
}

async function resolveWebhookIp(rawUrl) {
    const parsed = new URL(rawUrl);
    const hostname = String(parsed.hostname || '').toLowerCase();
    if (net.isIP(hostname)) {
        assertPublicIp(hostname);
        return hostname;
    }
    const records = await dnsLookup(hostname, { all: true });
    if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Webhook 目标域名无法解析');
    }
    for (const record of records) {
        assertPublicIp(record.address);
    }
    return records[0].address;
}

function sendWebhookBoundRequest(rawUrl, bodyText) {
    const parsed = new URL(rawUrl);
    return resolveWebhookIp(rawUrl).then((targetIp) => {
        const transport = parsed.protocol === 'https:' ? https : http;
        const payload = Buffer.from(String(bodyText || ''), 'utf8');
        const requestOptions = {
            protocol: parsed.protocol,
            hostname: targetIp,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: `${parsed.pathname || '/'}${parsed.search || ''}`,
            method: 'POST',
            timeout: 10000,
            headers: {
                'Host': parsed.host,
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': String(payload.length),
            },
            servername: parsed.hostname,
        };

        return new Promise((resolve, reject) => {
            const req = transport.request(requestOptions, (res) => {
                const chunks = [];
                res.on('data', chunk => chunks.push(Buffer.from(chunk)));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString('utf8');
                    const status = Number(res.statusCode || 0);
                    if (status >= 200 && status < 300) {
                        resolve({ ok: true, code: String(status), msg: 'ok', raw: { status, body: text } });
                    } else {
                        resolve({ ok: false, code: String(status || 'error'), msg: `Webhook status ${status}`, raw: { status, body: text } });
                    }
                });
            });
            req.on('timeout', () => {
                req.destroy(new Error('Webhook request timeout'));
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    });
}

function assertRequiredText(name, value) {
    const text = String(value || '').trim();
    if (!text) {
        throw new Error(`${name} 不能为空`);
    }
    return text;
}

/**
 * 发送推送
 * @param {object} payload
 * @param {string} payload.channel 必填 推送渠道（pushoo 平台名，如 webhook）
 * @param {string} [payload.endpoint] webhook 接口地址（channel=webhook 时使用）
 * @param {string} payload.token 必填 推送 token
 * @param {string} payload.title 必填 推送标题
 * @param {string} payload.content 必填 推送内容
 * @returns {Promise<{ok: boolean, code: string, msg: string, raw: any}>} 推送结果
 */
async function sendPushooMessage(payload = {}) {
    const channel = assertRequiredText('channel', payload.channel);
    const endpoint = String(payload.endpoint || '').trim();
    const rawToken = String(payload.token || '').trim();
    const token = channel === 'webhook' ? rawToken : assertRequiredText('token', rawToken);
    const title = assertRequiredText('title', payload.title);
    const content = assertRequiredText('content', payload.content);

    const options = {};
    if (channel === 'webhook') {
        const url = assertRequiredText('endpoint', endpoint);
        await assertSafeWebhookUrl(url);
        const webhookRes = await sendWebhookBoundRequest(url, JSON.stringify({ title, content }));
        return webhookRes;
    }

    const request = { title, content };
    if (token) request.token = token;
    if (channel === 'webhook') request.options = options;

    const result = await pushoo(channel, request);

    const raw = (result && typeof result === 'object') ? result : { data: result };
    const hasError = !!(raw && raw.error);
    const code = String(raw.code || raw.errcode || (hasError ? 'error' : 'ok'));
    const message = String(raw.msg || raw.message || (hasError ? (raw.error.message || 'push failed') : 'ok'));
    const ok = !hasError && (code === 'ok' || code === '0' || code === '' || String(raw.status || '').toLowerCase() === 'success');

    return {
        ok,
        code,
        msg: message,
        raw,
    };
}

module.exports = {
    sendPushooMessage,
};
