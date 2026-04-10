import { Pool } from 'pg';
import dotenv from 'dotenv';
import { memQuery } from './memoryStore';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 3000,
});

let useMemory = false;

export async function checkConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    useMemory = false;
    return true;
  } catch {
    console.warn('PostgreSQL 無法連線，切換到記憶體模式（資料重啟後清空）');
    useMemory = true;
    return false;
  }
}

export async function query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }> {
  if (useMemory) {
    const r = memQuery(text, params || []);
    return { ...r, rowCount: r.rows.length };
  }
  const res = await pool.query(text, params);
  return res;
}

export function isMemoryMode(): boolean {
  return useMemory;
}

/**
 * 自動補齊 schema：確保所有程式碼依賴的欄位與索引存在
 * 使用 IF NOT EXISTS，多次執行安全
 */
export async function ensureSchema(): Promise<void> {
  if (useMemory) return;
  const fixes: string[] = [
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
      await pool.query(sql);
    } catch (err: any) {
      console.warn(`[DB] ensureSchema skipped: ${sql.substring(0, 60)}... — ${err.message}`);
    }
  }
  console.log('[DB] Schema 自動補齊完成');
}
