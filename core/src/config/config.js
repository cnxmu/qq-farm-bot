const process = require('node:process');
/**
 * 配置常量与枚举定义
 */

function parseCorsOrigins(raw) {
    const list = String(raw || '')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    return Array.from(new Set(list));
}

function parsePositiveNumber(raw, fallback) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return n;
}

const CONFIG = {
    serverUrl: 'wss://gate-obt.nqf.qq.com/prod/ws',
    clientVersion: '1.6.0.14_20251224',
    platform: 'qq',              // 平台: qq 或 wx (可通过 --wx 切换为微信)
    os: 'iOS',
    heartbeatInterval: 25000,    // 心跳间隔 25秒
    farmCheckInterval: 2000,      // 兼容旧逻辑：自己农场固定巡查间隔(ms)
    friendCheckInterval: 10000,   // 兼容旧逻辑：好友固定巡查间隔(ms)
    farmCheckIntervalMin: 2000,   // 新逻辑：农场巡查间隔最小值(ms)
    farmCheckIntervalMax: 2000,   // 新逻辑：农场巡查间隔最大值(ms)
    friendCheckIntervalMin: 10000,// 新逻辑：好友巡查间隔最小值(ms)
    friendCheckIntervalMax: 10000,// 新逻辑：好友巡查间隔最大值(ms)
    adminPort: Number(process.env.ADMIN_PORT || 3000), // 管理面板 HTTP 端口
    adminPassword: String(process.env.ADMIN_PASSWORD || '').trim(),
    adminTokenTtlMs: parsePositiveNumber(process.env.ADMIN_TOKEN_TTL_HOURS, 24) * 60 * 60 * 1000,
    corsOrigins: parseCorsOrigins(process.env.ADMIN_CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000'),
};

// 生长阶段枚举
const PlantPhase = {
    UNKNOWN: 0,
    SEED: 1,
    GERMINATION: 2,
    SMALL_LEAVES: 3,
    LARGE_LEAVES: 4,
    BLOOMING: 5,
    MATURE: 6,
    DEAD: 7,
};

const PHASE_NAMES = ['未知', '种子', '发芽', '小叶', '大叶', '开花', '成熟', '枯死'];

module.exports = { CONFIG, PlantPhase, PHASE_NAMES };
