"use strict";
/**
 * Threads 多帳號 Session 管理
 * 帳號資料儲存於資料庫（accounts 表），支援多帳號切換
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccounts = getAccounts;
exports.getActiveAccount = getActiveAccount;
exports.addAccount = addAccount;
exports.deleteAccount = deleteAccount;
exports.switchAccount = switchAccount;
exports.updateAccountUsername = updateAccountUsername;
exports.updateAccountCookies = updateAccountCookies;
exports.hasSession = hasSession;
exports.clearActiveSession = clearActiveSession;
exports.getBrowserLoginStatus = getBrowserLoginStatus;
exports.startBrowserLogin = startBrowserLogin;
exports.createAuthenticatedContext = createAuthenticatedContext;
const playwright_1 = require("playwright");
const client_1 = require("../db/client");
const uuid_1 = require("uuid");
const utils_1 = require("../utils");
// ─── DB helpers ──────────────────────────────────────────────────────────────
async function getAccounts() {
    const res = await (0, client_1.query)('SELECT id, name, username, is_active, created_at FROM accounts ORDER BY created_at ASC');
    return res.rows;
}
async function getActiveAccount() {
    const res = await (0, client_1.query)('SELECT * FROM accounts WHERE is_active = true LIMIT 1');
    return res.rows[0] || null;
}
async function addAccount(name, rawCookies) {
    const sessionData = buildStorageState(rawCookies);
    const id = (0, uuid_1.v4)();
    const isFirstAccount = (await getAccounts()).length === 0;
    const res = await (0, client_1.query)(`INSERT INTO accounts (id, name, username, session_data, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id, name, username, is_active, created_at`, [id, name, '', JSON.stringify(sessionData), isFirstAccount]);
    return res.rows[0];
}
async function deleteAccount(id) {
    const acc = await (0, client_1.query)('SELECT is_active FROM accounts WHERE id = $1', [id]);
    await (0, client_1.query)('DELETE FROM accounts WHERE id = $1', [id]);
    // If we deleted the active account, activate the first remaining one
    if (acc.rows[0]?.is_active) {
        const remaining = await (0, client_1.query)('SELECT id FROM accounts ORDER BY created_at ASC LIMIT 1');
        if (remaining.rows[0]) {
            await (0, client_1.query)('UPDATE accounts SET is_active = true WHERE id = $1', [remaining.rows[0].id]);
        }
    }
}
async function switchAccount(id) {
    await (0, client_1.query)('UPDATE accounts SET is_active = false WHERE is_active = true');
    const res = await (0, client_1.query)('UPDATE accounts SET is_active = true WHERE id = $1 RETURNING id, name, username, is_active, created_at', [id]);
    return res.rows[0] || null;
}
async function updateAccountUsername(id, username) {
    await (0, client_1.query)('UPDATE accounts SET username = $1 WHERE id = $2', [username, id]);
}
async function updateAccountCookies(id, rawCookies) {
    const sessionData = buildStorageState(rawCookies);
    const res = await (0, client_1.query)(`UPDATE accounts SET session_data = $1 WHERE id = $2
     RETURNING id, name, username, is_active, created_at`, [JSON.stringify(sessionData), id]);
    if (!res.rows[0])
        throw new Error('帳號不存在');
    return res.rows[0];
}
// ─── Session helpers ──────────────────────────────────────────────────────────
async function hasSession() {
    const acc = await getActiveAccount();
    return !!(acc?.session_data);
}
async function clearActiveSession() {
    const acc = await getActiveAccount();
    if (acc) {
        await (0, client_1.query)('UPDATE accounts SET session_data = NULL WHERE id = $1', [acc.id]);
    }
}
// ─── Cookie parsing ───────────────────────────────────────────────────────────
function parseCookies(raw) {
    raw = raw.trim();
    if (raw.startsWith('[')) {
        const arr = JSON.parse(raw);
        return arr.map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain || '.threads.net',
            path: c.path || '/',
            httpOnly: c.httpOnly || false,
            secure: c.secure !== false,
            sameSite: (0, utils_1.normalizeSameSite)(c.sameSite),
        }));
    }
    return raw.split(';').map(pair => {
        const [name, ...rest] = pair.trim().split('=');
        return {
            name: name.trim(),
            value: rest.join('=').trim(),
            domain: '.threads.net',
            path: '/',
            httpOnly: false,
            secure: true,
            sameSite: 'Lax',
        };
    }).filter((c) => c.name && c.value);
}
function buildStorageState(rawCookies) {
    const cookies = parseCookies(rawCookies);
    if (cookies.length === 0) {
        throw new Error('無法解析 cookies，請確認格式正確');
    }
    return {
        cookies: cookies.map((c) => ({
            ...c,
            domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
            expires: -1,
        })),
        origins: [],
    };
}
let _loginSession = null;
let _loginCleanup = null;
function getBrowserLoginStatus() {
    return _loginSession;
}
async function startBrowserLogin(name) {
    // 清理舊的 session
    if (_loginCleanup) {
        _loginCleanup();
        _loginCleanup = null;
    }
    _loginSession = { status: 'pending' };
    // On Railway/Linux without display, headed browser won't work
    if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
        _loginSession = { status: 'failed', error: '此功能僅在本機後端執行時可用，請在本機啟動後端後再試' };
        return;
    }
    let browser;
    try {
        browser = await playwright_1.chromium.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=zh-TW'],
        });
    }
    catch (err) {
        _loginSession = { status: 'failed', error: '無法啟動瀏覽器：' + (err instanceof Error ? err.message : String(err)) };
        return;
    }
    const context = await browser.newContext({
        locale: 'zh-TW',
        timezoneId: 'Asia/Taipei',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1200, height: 800 },
    });
    const page = await context.newPage();
    await page.goto('https://www.threads.net/login', { waitUntil: 'domcontentloaded' });
    let finished = false;
    const cleanup = () => {
        finished = true;
        clearInterval(pollInterval);
        clearTimeout(timeoutHandle);
        browser.close().catch(() => { });
    };
    _loginCleanup = cleanup;
    // 輪詢登入狀態
    const pollInterval = setInterval(async () => {
        if (finished)
            return;
        try {
            const cookies = await context.cookies('https://www.threads.net');
            const sessionId = cookies.find(c => c.name === 'sessionid');
            const dsUserId = cookies.find(c => c.name === 'ds_user_id');
            if (sessionId && dsUserId) {
                finished = true;
                clearInterval(pollInterval);
                clearTimeout(timeoutHandle);
                // 嘗試取得用戶名
                let username = '';
                try {
                    const url = page.url();
                    const match = url.match(/threads\.net\/@([^/?]+)/);
                    if (match)
                        username = match[1];
                    if (!username) {
                        const profileLink = await page.$('a[href*="/@"]');
                        if (profileLink) {
                            const href = await profileLink.getAttribute('href');
                            const m = href?.match(/\/@([^/?]+)/);
                            if (m)
                                username = m[1];
                        }
                    }
                    if (!username)
                        username = dsUserId.value;
                }
                catch { }
                // 儲存帳號
                const sessionData = {
                    cookies: cookies.map(c => ({
                        name: c.name,
                        value: c.value,
                        domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
                        path: c.path || '/',
                        httpOnly: c.httpOnly || false,
                        secure: c.secure !== false,
                        sameSite: (0, utils_1.normalizeSameSite)(c.sameSite),
                        expires: -1,
                    })),
                    origins: [],
                };
                const id = (0, uuid_1.v4)();
                const isFirst = (await getAccounts()).length === 0;
                await (0, client_1.query)(`INSERT INTO accounts (id, name, username, session_data, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT DO NOTHING`, [id, name, username, JSON.stringify(sessionData), isFirst]);
                _loginSession = { status: 'success', accountId: id, username };
                console.log(`[BrowserLogin] 登入成功：${name} (@${username})`);
                setTimeout(() => browser.close().catch(() => { }), 2000);
            }
        }
        catch (err) {
            console.error('[BrowserLogin] poll error:', err);
        }
    }, 2000);
    // 5 分鐘超時
    const timeoutHandle = setTimeout(() => {
        if (!finished) {
            finished = true;
            clearInterval(pollInterval);
            _loginSession = { status: 'timeout', error: '登入逾時，請重試' };
            browser.close().catch(() => { });
        }
    }, 300000);
}
// ─── Playwright context ───────────────────────────────────────────────────────
async function createAuthenticatedContext() {
    const browser = await playwright_1.chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--lang=zh-TW',
        ],
    });
    const contextOptions = {
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
        raw.cookies = raw.cookies.map((c) => ({
            ...c,
            sameSite: (0, utils_1.normalizeSameSite)(c.sameSite),
        }));
        contextOptions.storageState = raw;
        console.log(`[Auth] 使用帳號「${acc.name}」的 session`);
    }
    const context = await browser.newContext(contextOptions);
    return { browser, context };
}
