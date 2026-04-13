"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const threadsAuth_1 = require("../services/threadsAuth");
const threadsApiService_1 = require("../services/threadsApiService");
const router = (0, express_1.Router)();
// GET /api/auth/status
router.get('/status', async (_req, res) => {
    const loggedIn = await (0, threadsAuth_1.hasSession)();
    const active = await (0, threadsAuth_1.getActiveAccount)();
    res.json({
        logged_in: loggedIn,
        active_account: active
            ? { id: active.id, name: active.name, username: active.username }
            : null,
    });
});
// GET /api/auth/accounts
router.get('/accounts', async (_req, res) => {
    const accounts = await (0, threadsAuth_1.getAccounts)();
    res.json({ accounts });
});
// POST /api/auth/accounts — 新增帳號
router.post('/accounts', async (req, res) => {
    const { name, cookies } = req.body;
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: '請提供帳號名稱' });
    }
    if (!cookies || typeof cookies !== 'string') {
        return res.status(400).json({ error: '請提供 cookies 字串' });
    }
    try {
        const account = await (0, threadsAuth_1.addAccount)(name.trim(), cookies.trim());
        res.json({ success: true, account });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Cookies 格式錯誤' });
    }
});
// PATCH /api/auth/accounts/:id — 更新帳號 Cookie
router.patch('/accounts/:id', async (req, res) => {
    const { id } = req.params;
    const { cookies } = req.body;
    if (!cookies || typeof cookies !== 'string') {
        return res.status(400).json({ error: '請提供 cookies 字串' });
    }
    try {
        const account = await (0, threadsAuth_1.updateAccountCookies)(id, cookies.trim());
        res.json({ success: true, account });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : '更新失敗' });
    }
});
// DELETE /api/auth/accounts/:id — 刪除帳號
router.delete('/accounts/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await (0, threadsAuth_1.deleteAccount)(id);
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : '刪除失敗' });
    }
});
// POST /api/auth/accounts/:id/switch — 切換帳號
router.post('/accounts/:id/switch', async (req, res) => {
    const { id } = req.params;
    try {
        const account = await (0, threadsAuth_1.switchAccount)(id);
        if (!account)
            return res.status(404).json({ error: '帳號不存在' });
        res.json({ success: true, account });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : '切換失敗' });
    }
});
// POST /api/auth/accounts/browser-login — 開啟瀏覽器視窗讓使用者登入 Threads
router.post('/accounts/browser-login', async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: '請提供帳號名稱' });
    }
    try {
        (0, threadsAuth_1.startBrowserLogin)(name.trim()); // 非同步，不 await
        res.json({ success: true, message: '瀏覽器已開啟，請在視窗中登入 Threads' });
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : '啟動失敗' });
    }
});
// GET /api/auth/accounts/browser-login/status — 查詢登入狀態
router.get('/accounts/browser-login/status', (_req, res) => {
    const status = (0, threadsAuth_1.getBrowserLoginStatus)();
    if (!status)
        return res.json({ status: 'idle' });
    res.json(status);
});
// POST /api/auth/logout — 清除目前帳號的 session
router.post('/logout', async (_req, res) => {
    await (0, threadsAuth_1.clearActiveSession)();
    res.json({ success: true, message: 'Session 已清除' });
});
// ─── Threads Official API OAuth ───────────────────────────────────────────────
// GET /api/auth/threads/oauth-url — 取得 OAuth 授權 URL
router.get('/threads/oauth-url', (_req, res) => {
    try {
        const url = (0, threadsApiService_1.getOAuthUrl)();
        res.json({ url, success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /api/auth/threads/callback — OAuth 回呼，交換 code 取得 token
router.get('/threads/callback', async (req, res) => {
    const { code, error, error_description } = req.query;
    if (error) {
        const msg = encodeURIComponent(error_description || error);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?threads_auth=error&msg=${msg}`);
    }
    if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?threads_auth=error&msg=missing_code`);
    }
    try {
        const { userId, username, accessToken, expiresAt } = await (0, threadsApiService_1.exchangeCodeForToken)(code);
        await (0, threadsApiService_1.saveApiAccount)({ userId, username, accessToken, expiresAt });
        console.log(`[OAuth] Threads API 帳號已授權: @${username} (${userId})`);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?threads_auth=success&username=${encodeURIComponent(username)}`);
    }
    catch (err) {
        console.error('[OAuth] callback 失敗:', err.message);
        const msg = encodeURIComponent(err.message);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?threads_auth=error&msg=${msg}`);
    }
});
// POST /api/auth/threads/manual-token — 手動輸入 Access Token
router.post('/threads/manual-token', async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken || typeof accessToken !== 'string') {
        return res.status(400).json({ error: '請提供 Access Token' });
    }
    try {
        const { userId, username } = await (0, threadsApiService_1.verifyAndSaveManualToken)(accessToken.trim());
        res.json({ success: true, username, userId });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// GET /api/auth/threads/api-status — 查詢 API token 狀態
router.get('/threads/api-status', async (_req, res) => {
    const acc = await (0, threadsApiService_1.getActiveApiAccount)();
    if (!acc)
        return res.json({ connected: false });
    const nowSec = Math.floor(Date.now() / 1000);
    const expired = acc.token_expires_at > 0 && nowSec > acc.token_expires_at;
    res.json({
        connected: !expired,
        username: acc.threads_username,
        expires_at: acc.token_expires_at,
        expired,
    });
});
exports.default = router;
