/**
 * Threads 多帳號 Session 管理
 * 帳號資料儲存於資料庫（accounts 表），支援多帳號切換
 */

import { chromium } from 'playwright';
import { query } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { normalizeSameSite } from '../utils';

export interface Account {
  id: string;
  name: string;
  username: string;
  session_data: any | null;
  is_active: boolean;
  created_at: Date;
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

export async function getAccounts(): Promise<Account[]> {
  const res = await query(
    'SELECT id, name, username, is_active, created_at FROM accounts ORDER BY created_at ASC'
  );
  return res.rows;
}

export async function getActiveAccount(): Promise<Account | null> {
  const res = await query(
    'SELECT * FROM accounts WHERE is_active = true LIMIT 1'
  );
  return res.rows[0] || null;
}

export async function addAccount(name: string, rawCookies: string): Promise<Account> {
  const sessionData = buildStorageState(rawCookies);
  const id = uuidv4();
  const isFirstAccount = (await getAccounts()).length === 0;

  const res = await query(
    `INSERT INTO accounts (id, name, username, session_data, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id, name, username, is_active, created_at`,
    [id, name, '', JSON.stringify(sessionData), isFirstAccount]
  );
  return res.rows[0];
}

export async function deleteAccount(id: string): Promise<void> {
  const acc = await query('SELECT is_active FROM accounts WHERE id = $1', [id]);
  await query('DELETE FROM accounts WHERE id = $1', [id]);

  // If we deleted the active account, activate the first remaining one
  if (acc.rows[0]?.is_active) {
    const remaining = await query('SELECT id FROM accounts ORDER BY created_at ASC LIMIT 1');
    if (remaining.rows[0]) {
      await query('UPDATE accounts SET is_active = true WHERE id = $1', [remaining.rows[0].id]);
    }
  }
}

export async function switchAccount(id: string): Promise<Account | null> {
  await query('UPDATE accounts SET is_active = false WHERE is_active = true');
  const res = await query(
    'UPDATE accounts SET is_active = true WHERE id = $1 RETURNING id, name, username, is_active, created_at',
    [id]
  );
  return res.rows[0] || null;
}

export async function updateAccountUsername(id: string, username: string): Promise<void> {
  await query('UPDATE accounts SET username = $1 WHERE id = $2', [username, id]);
}

// ─── Session helpers ──────────────────────────────────────────────────────────

export async function hasSession(): Promise<boolean> {
  const acc = await getActiveAccount();
  return !!(acc?.session_data);
}

export async function clearActiveSession(): Promise<void> {
  const acc = await getActiveAccount();
  if (acc) {
    await query('UPDATE accounts SET session_data = NULL WHERE id = $1', [acc.id]);
  }
}

// ─── Cookie parsing ───────────────────────────────────────────────────────────

function parseCookies(raw: string): Array<any> {
  raw = raw.trim();

  if (raw.startsWith('[')) {
    const arr = JSON.parse(raw);
    return arr.map((c: any) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '.threads.com',
      path: c.path || '/',
      httpOnly: c.httpOnly || false,
      secure: c.secure !== false,
      sameSite: normalizeSameSite(c.sameSite),
    }));
  }

  return raw.split(';').map(pair => {
    const [name, ...rest] = pair.trim().split('=');
    return {
      name: name.trim(),
      value: rest.join('=').trim(),
      domain: '.threads.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax' as const,
    };
  }).filter((c: any) => c.name && c.value);
}

function buildStorageState(rawCookies: string): any {
  const cookies = parseCookies(rawCookies);
  if (cookies.length === 0) {
    throw new Error('無法解析 cookies，請確認格式正確');
  }
  return {
    cookies: cookies.map((c: any) => ({
      ...c,
      domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
      expires: -1,
    })),
    origins: [],
  };
}

// ─── Playwright context ───────────────────────────────────────────────────────

export async function createAuthenticatedContext() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--lang=zh-TW',
    ],
  });

  const contextOptions: any = {
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  };

  const acc = await getActiveAccount();
  if (acc?.session_data) {
    const raw = typeof acc.session_data === 'string'
      ? JSON.parse(acc.session_data)
      : acc.session_data;
    raw.cookies = raw.cookies.map((c: any) => ({
      ...c,
      sameSite: normalizeSameSite(c.sameSite),
    }));
    contextOptions.storageState = raw;
    console.log(`[Auth] 使用帳號「${acc.name}」的 session`);
  }

  const context = await browser.newContext(contextOptions);
  return { browser, context };
}
