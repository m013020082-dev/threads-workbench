"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.checkConnection = checkConnection;
exports.query = query;
exports.isMemoryMode = isMemoryMode;
exports.ensureSchema = ensureSchema;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const memoryStore_1 = require("./memoryStore");
dotenv_1.default.config();
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
});
let useMemory = false;
async function checkConnection() {
    try {
        await exports.pool.query('SELECT 1');
        useMemory = false;
        return true;
    }
    catch {
        console.warn('PostgreSQL 無法連線，切換到記憶體模式（資料重啟後清空）');
        useMemory = true;
        return false;
    }
}
// Periodically retry DB connection when in memory mode
setInterval(async () => {
    if (useMemory && process.env.DATABASE_URL) {
        try {
            await exports.pool.query('SELECT 1');
            useMemory = false;
            console.log('[DB] PostgreSQL 重新連線成功，切換回資料庫模式');
            await ensureSchema();
        }
        catch {
            // still unavailable
        }
    }
}, 30000);
async function query(text, params) {
    if (useMemory) {
        const r = (0, memoryStore_1.memQuery)(text, params || []);
        return { ...r, rowCount: r.rows.length };
    }
    const res = await exports.pool.query(text, params);
    return res;
}
function isMemoryMode() {
    return useMemory;
}
/**
 * 自動補齊 schema：確保所有程式碼依賴的欄位與索引存在
 * 使用 IF NOT EXISTS，多次執行安全
 */
async function ensureSchema() {
    if (useMemory)
        return;
    const fixes = [
        // posts: ON CONFLICT (post_url) 需要 UNIQUE index
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_posts_post_url ON posts (post_url)',
        // drafts: 程式碼使用 draft_text、workspace_id、risk_warnings
        "ALTER TABLE drafts ADD COLUMN IF NOT EXISTS draft_text TEXT DEFAULT ''",
        'ALTER TABLE drafts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL',
        'ALTER TABLE drafts ADD COLUMN IF NOT EXISTS risk_warnings TEXT[] DEFAULT ARRAY[]::TEXT[]',
        // interactions: 程式碼使用 workspace_id
        'ALTER TABLE interactions ADD COLUMN IF NOT EXISTS workspace_id UUID',
    ];
    for (const sql of fixes) {
        try {
            await exports.pool.query(sql);
        }
        catch (err) {
            console.warn(`[DB] ensureSchema skipped: ${sql.substring(0, 60)}... — ${err.message}`);
        }
    }
    console.log('[DB] Schema 自動補齊完成');
}
