import { Router, Request, Response } from 'express';
import {
  hasSession,
  clearActiveSession,
  getAccounts,
  getActiveAccount,
  addAccount,
  deleteAccount,
  switchAccount,
} from '../services/threadsAuth';
import {
  getOAuthUrl,
  exchangeCodeForToken,
  saveApiAccount,
  getActiveApiAccount,
} from '../services/threadsApiService';

const router = Router();

// GET /api/auth/status
router.get('/status', async (_req: Request, res: Response) => {
  const loggedIn = await hasSession();
  const active = await getActiveAccount();
  res.json({
    logged_in: loggedIn,
    active_account: active
      ? { id: active.id, name: active.name, username: active.username }
      : null,
  });
});

// GET /api/auth/accounts
router.get('/accounts', async (_req: Request, res: Response) => {
  const accounts = await getAccounts();
  res.json({ accounts });
});

// POST /api/auth/accounts — 新增帳號
router.post('/accounts', async (req: Request, res: Response) => {
  const { name, cookies } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: '請提供帳號名稱' });
  }
  if (!cookies || typeof cookies !== 'string') {
    return res.status(400).json({ error: '請提供 cookies 字串' });
  }
  try {
    const account = await addAccount(name.trim(), cookies.trim());
    res.json({ success: true, account });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Cookies 格式錯誤' });
  }
});

// DELETE /api/auth/accounts/:id — 刪除帳號
router.delete('/accounts/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await deleteAccount(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '刪除失敗' });
  }
});

// POST /api/auth/accounts/:id/switch — 切換帳號
router.post('/accounts/:id/switch', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const account = await switchAccount(id);
    if (!account) return res.status(404).json({ error: '帳號不存在' });
    res.json({ success: true, account });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '切換失敗' });
  }
});

// POST /api/auth/logout — 清除目前帳號的 session
router.post('/logout', async (_req: Request, res: Response) => {
  await clearActiveSession();
  res.json({ success: true, message: 'Session 已清除' });
});

// ─── Threads Official API OAuth ───────────────────────────────────────────────

// GET /api/auth/threads/oauth-url — 取得 OAuth 授權 URL
router.get('/threads/oauth-url', (_req: Request, res: Response) => {
  try {
    const url = getOAuthUrl();
    res.json({ url, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/threads/callback — OAuth 回呼，交換 code 取得 token
router.get('/threads/callback', async (req: Request, res: Response) => {
  const { code, error, error_description } = req.query as Record<string, string>;

  if (error) {
    const msg = encodeURIComponent(error_description || error);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?threads_auth=error&msg=${msg}`);
  }
  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?threads_auth=error&msg=missing_code`);
  }

  try {
    const { userId, username, accessToken, expiresAt } = await exchangeCodeForToken(code);
    await saveApiAccount({ userId, username, accessToken, expiresAt });
    console.log(`[OAuth] Threads API 帳號已授權: @${username} (${userId})`);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?threads_auth=success&username=${encodeURIComponent(username)}`);
  } catch (err: any) {
    console.error('[OAuth] callback 失敗:', err.message);
    const msg = encodeURIComponent(err.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?threads_auth=error&msg=${msg}`);
  }
});

// GET /api/auth/threads/api-status — 查詢 API token 狀態
router.get('/threads/api-status', async (_req: Request, res: Response) => {
  const acc = await getActiveApiAccount();
  if (!acc) return res.json({ connected: false });
  const nowSec = Math.floor(Date.now() / 1000);
  const expired = acc.token_expires_at > 0 && nowSec > acc.token_expires_at;
  res.json({
    connected: !expired,
    username: acc.threads_username,
    expires_at: acc.token_expires_at,
    expired,
  });
});

export default router;
