/**
 * Threads Official API Service
 * 使用 Meta Threads API (graph.threads.net) 執行回覆、發文
 * 文件: https://developers.facebook.com/docs/threads
 */

import { query } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { createAuthenticatedContext } from './threadsAuth';

const THREADS_API = 'https://graph.threads.net/v1.0';
const OAUTH_URL = 'https://threads.net/oauth/authorize';
const TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
const LONG_TOKEN_URL = `${THREADS_API}/access_token`;

// ─── Shortcode → Media ID ────────────────────────────────────────────────────

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function shortcodeToMediaId(shortcode: string): string {
  let id = BigInt(0);
  for (const char of shortcode) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) continue;
    id = id * BigInt(64) + BigInt(idx);
  }
  return id.toString();
}

export function extractShortcodeFromUrl(postUrl: string): string | null {
  // https://www.threads.com/@username/post/SHORTCODE
  const match = postUrl.match(/\/post\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function getOAuthUrl(): string {
  const appId = process.env.THREADS_APP_ID;
  const redirectUri = process.env.THREADS_REDIRECT_URI;
  if (!appId || !redirectUri) throw new Error('缺少 THREADS_APP_ID 或 THREADS_REDIRECT_URI 環境變數');

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: 'threads_basic,threads_content_publish',
    response_type: 'code',
  });
  return `${OAUTH_URL}?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  userId: string;
  username: string;
  accessToken: string;
  expiresAt: number;
}> {
  const appId = process.env.THREADS_APP_ID!;
  const appSecret = process.env.THREADS_APP_SECRET!;
  const redirectUri = process.env.THREADS_REDIRECT_URI!;

  // Step 1: short-lived token
  const shortRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });
  const shortData = await shortRes.json() as any;
  if (shortData.error) throw new Error(shortData.error.message || JSON.stringify(shortData.error));

  const shortToken: string = shortData.access_token;
  const userId: string = String(shortData.user_id);

  // Step 2: exchange for long-lived token (60 days)
  const longRes = await fetch(
    `${LONG_TOKEN_URL}?grant_type=th_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
  );
  const longData = await longRes.json() as any;
  if (longData.error) throw new Error(longData.error.message || JSON.stringify(longData.error));

  const accessToken: string = longData.access_token;
  const expiresAt = Math.floor(Date.now() / 1000) + (longData.expires_in || 5184000);

  // Step 3: get username
  const meRes = await fetch(`${THREADS_API}/me?fields=id,username&access_token=${accessToken}`);
  const meData = await meRes.json() as any;
  const username: string = meData.username || '';

  return { userId, username, accessToken, expiresAt };
}

// ─── Manual Token ────────────────────────────────────────────────────────────

export async function verifyAndSaveManualToken(accessToken: string): Promise<{ userId: string; username: string }> {
  const appId = process.env.THREADS_APP_ID || '';
  // Verify token by calling /me endpoint (include client_id as required by Threads API)
  const params = new URLSearchParams({ fields: 'id,username', access_token: accessToken });
  if (appId) params.set('client_id', appId);
  const meRes = await fetch(`${THREADS_API}/me?${params}`);
  const meData = await meRes.json() as any;

  if (meData.error) {
    throw new Error(`Token 驗證失敗: ${meData.error.message || JSON.stringify(meData.error)}`);
  }

  const userId: string = meData.id;
  const username: string = meData.username || '';

  // Long-lived tokens have ~60 days expiry; use 0 to mean "unknown/no expiry"
  const expiresAt = 0;

  await saveApiAccount({ userId, username, accessToken, expiresAt });
  return { userId, username };
}

// ─── Account helpers ─────────────────────────────────────────────────────────

export async function getActiveApiAccount(): Promise<{
  id: string;
  threads_user_id: string;
  threads_username: string;
  access_token: string;
  token_expires_at: number;
} | null> {
  const res = await query(
    'SELECT * FROM publisher_accounts WHERE is_active = true LIMIT 1'
  );
  return res.rows[0] || null;
}

export async function saveApiAccount(params: {
  workspaceId?: string;
  userId: string;
  username: string;
  accessToken: string;
  expiresAt: number;
}): Promise<void> {
  // Deactivate all, then upsert by threads_user_id
  await query('UPDATE publisher_accounts SET is_active = false');
  const existing = await query(
    'SELECT id FROM publisher_accounts WHERE threads_user_id = $1',
    [params.userId]
  );
  if (existing.rows.length > 0) {
    await query(
      `UPDATE publisher_accounts
       SET access_token=$1, token_expires_at=$2, threads_username=$3, is_active=true, updated_at=NOW()
       WHERE threads_user_id=$4`,
      [params.accessToken, params.expiresAt, params.username, params.userId]
    );
  } else {
    await query(
      `INSERT INTO publisher_accounts
         (id, workspace_id, threads_user_id, threads_username, access_token, token_expires_at, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [uuidv4(), params.workspaceId || null, params.userId, params.username, params.accessToken, params.expiresAt]
    );
  }
}

// ─── Resolve Threads Media ID via Playwright ─────────────────────────────────

async function resolveMediaIdViaPlaywright(postUrl: string): Promise<string | null> {
  console.log(`[ThreadsAPI] 用 Playwright 取得 media ID: ${postUrl}`);
  const { browser, context } = await createAuthenticatedContext();
  let mediaId: string | null = null;

  try {
    const page = await context.newPage();

    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('threads.net') && !url.includes('instagram.com')) return;
      try {
        const text = await response.text();
        // 尋找 "pk":"數字ID" 或 "id":"數字ID" 搭配 shortcode
        const shortcode = postUrl.match(/\/post\/([A-Za-z0-9_-]+)/)?.[1];
        if (!shortcode) return;

        // 確認 shortcode 在同一 response 內才取用 pk
        if (!text.includes(shortcode)) return;

        const pkMatch = text.match(/"pk"\s*:\s*"(\d{15,20})"/);
        if (pkMatch) { mediaId = pkMatch[1]; return; }

        // 也試 id 欄位
        const idMatch = text.match(/"id"\s*:\s*"(\d{15,20})"/);
        if (idMatch) mediaId = idMatch[1];
      } catch {}
    });

    await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000); // 等 API 回應完成
  } catch (err: any) {
    console.warn(`[ThreadsAPI] Playwright 取得 media ID 失敗: ${err.message}`);
  } finally {
    await browser.close();
  }

  if (mediaId) {
    console.log(`[ThreadsAPI] Playwright 取得 media ID: ${mediaId}`);
    // 存入 DB 供下次使用
    await query('UPDATE posts SET threads_media_id = $1 WHERE post_url = $2', [mediaId, postUrl]);
  }
  return mediaId;
}

// ─── Reply to Post ────────────────────────────────────────────────────────────

export async function replyViaApi(postUrl: string, replyText: string): Promise<{
  success: boolean;
  error?: string;
  threadId?: string;
}> {
  const acc = await getActiveApiAccount();
  if (!acc) return { success: false, error: '尚未連接 Threads API，請先在帳號管理中完成 OAuth 授權' };

  // Token expiry check
  const nowSec = Math.floor(Date.now() / 1000);
  if (acc.token_expires_at > 0 && nowSec > acc.token_expires_at - 86400) {
    return { success: false, error: 'Threads API Token 即將過期或已失效，請重新授權' };
  }

  const shortcode = extractShortcodeFromUrl(postUrl);
  if (!shortcode) return { success: false, error: `無法從 URL 解析貼文 ID: ${postUrl}` };

  // 優先順序：1) DB 快取  2) Playwright 攔截（支援無 Cookie 模式）
  let replyToId: string | null = null;
  const dbRes = await query('SELECT threads_media_id FROM posts WHERE post_url = $1 LIMIT 1', [postUrl]);
  if (dbRes.rows[0]?.threads_media_id) {
    replyToId = dbRes.rows[0].threads_media_id;
    console.log(`[ThreadsAPI] 使用 DB media_id: ${replyToId}`);
  } else {
    replyToId = await resolveMediaIdViaPlaywright(postUrl);
    if (!replyToId) {
      return { success: false, error: '無法取得此貼文的 Threads Media ID（Playwright 攔截失敗）' };
    }
  }
  console.log(`[ThreadsAPI] 回覆貼文 ${shortcode} → media_id: ${replyToId}`);

  try {
    // Step 1: create reply container (use JSON to avoid percent-encoding issues)
    const createRes = await fetch(`${THREADS_API}/${acc.threads_user_id}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: replyText,
        reply_to_id: replyToId,
        access_token: acc.access_token,
      }),
    });
    const createData = await createRes.json() as any;
    if (createData.error) {
      console.error('[ThreadsAPI] 建立回覆容器失敗:', createData.error);
      return { success: false, error: `API 錯誤: ${createData.error.message || JSON.stringify(createData.error)}` };
    }

    const creationId: string = createData.id;
    console.log(`[ThreadsAPI] 回覆容器建立成功: ${creationId}`);

    // Step 2: publish
    await new Promise(r => setTimeout(r, 1000)); // Threads 建議等 1 秒再發布

    const publishRes = await fetch(`${THREADS_API}/${acc.threads_user_id}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: acc.access_token,
      }),
    });
    const publishData = await publishRes.json() as any;
    if (publishData.error) {
      console.error('[ThreadsAPI] 發布回覆失敗:', publishData.error);
      return { success: false, error: `發布失敗: ${publishData.error.message || JSON.stringify(publishData.error)}` };
    }

    console.log(`[ThreadsAPI] 回覆發布成功: ${publishData.id}`);
    return { success: true, threadId: publishData.id };
  } catch (err: any) {
    console.error('[ThreadsAPI] 回覆失敗:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Publish Post ─────────────────────────────────────────────────────────────

export async function publishViaApi(text: string): Promise<{
  success: boolean;
  error?: string;
  threadId?: string;
}> {
  const acc = await getActiveApiAccount();
  if (!acc) return { success: false, error: '尚未連接 Threads API，請先完成 OAuth 授權' };

  try {
    // Step 1: create container (use JSON to avoid percent-encoding issues with Chinese/emoji)
    const createRes = await fetch(`${THREADS_API}/${acc.threads_user_id}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'TEXT',
        text,
        access_token: acc.access_token,
      }),
    });
    const createData = await createRes.json() as any;
    if (createData.error) return { success: false, error: createData.error.message };

    await new Promise(r => setTimeout(r, 1000));

    // Step 2: publish
    const publishRes = await fetch(`${THREADS_API}/${acc.threads_user_id}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: createData.id,
        access_token: acc.access_token,
      }),
    });
    const publishData = await publishRes.json() as any;
    if (publishData.error) return { success: false, error: publishData.error.message };

    return { success: true, threadId: publishData.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
