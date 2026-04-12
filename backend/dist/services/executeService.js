"use strict";
/**
 * Computer Use 執行服務
 * 用 Playwright 開啟可見瀏覽器，自動填入留言草稿，等待使用者手動確認送出
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveSession = getActiveSession;
exports.closeSession = closeSession;
exports.startExecution = startExecution;
exports.startRadarExecution = startRadarExecution;
exports.confirmExecution = confirmExecution;
exports.cancelExecution = cancelExecution;
const playwright_1 = require("playwright");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const utils_1 = require("../utils");
const SESSION_FILE = path.join(process.cwd(), 'threads-session.json');
let activeBrowser = null;
let activePage = null;
let activeSession = null;
function getActiveSession() {
    return activeSession;
}
async function closeSession() {
    try {
        if (activePage) {
            await activePage.close().catch(() => { });
            activePage = null;
        }
        if (activeBrowser) {
            await activeBrowser.close().catch(() => { });
            activeBrowser = null;
        }
    }
    catch { }
    if (activeSession) {
        activeSession.status = 'cancelled';
    }
    activeSession = null;
}
/**
 * 開啟貼文頁面，定位留言框並填入草稿，停留等待人工確認
 */
async function startExecution(postId, draftId, postUrl, draftText) {
    // 若有現有 session，先關閉
    if (activeBrowser) {
        await closeSession();
    }
    activeSession = {
        status: 'opening',
        postId,
        draftId,
        postUrl,
        draftText,
        startedAt: new Date(),
    };
    try {
        // 載入 session cookies
        const contextOptions = {
            locale: 'zh-TW',
            timezoneId: 'Asia/Taipei',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 900 },
        };
        if (fs.existsSync(SESSION_FILE)) {
            const raw = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            raw.cookies = raw.cookies.map((c) => ({
                ...c,
                sameSite: (0, utils_1.normalizeSameSite)(c.sameSite),
            }));
            contextOptions.storageState = raw;
        }
        // 使用可見瀏覽器（headless: false）讓使用者可以手動操作
        activeBrowser = await playwright_1.chromium.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--lang=zh-TW',
                '--window-size=1280,900',
            ],
        });
        const context = await activeBrowser.newContext(contextOptions);
        activePage = await context.newPage();
        console.log(`[Execute] 開啟貼文頁面: ${postUrl}`);
        await activePage.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await activePage.waitForTimeout(3000);
        // 定位並點擊留言輸入框
        const commentSelectors = [
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"][aria-placeholder]',
            'div[contenteditable="true"]',
            'textarea[placeholder]',
        ];
        let commentBox = null;
        for (const sel of commentSelectors) {
            const el = activePage.locator(sel).first();
            const count = await el.count();
            if (count > 0) {
                commentBox = el;
                console.log(`[Execute] 找到留言框: ${sel}`);
                break;
            }
        }
        if (commentBox) {
            await commentBox.click({ timeout: 5000 }).catch(() => { });
            await activePage.waitForTimeout(500);
            // 清除既有內容再填入（多行用 Shift+Enter，避免 Enter 直接送出）
            await activePage.keyboard.press('Control+a');
            await activePage.waitForTimeout(200);
            const lines = draftText.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i])
                    await activePage.keyboard.type(lines[i], { delay: 30 });
                if (i < lines.length - 1) {
                    await activePage.keyboard.press('Shift+Enter');
                    await activePage.waitForTimeout(100);
                }
            }
            console.log(`[Execute] 留言草稿已填入（${draftText.length} 字）`);
        }
        else {
            console.warn('[Execute] 未找到留言輸入框，請手動點擊輸入框後貼上草稿');
            // 仍繼續，讓使用者手動處理
        }
        // 定位追蹤按鈕（只定位，不點擊）
        const followSelectors = [
            'button[data-testid*="follow"]',
            'button:has-text("追蹤")',
            'button:has-text("Follow")',
            '[aria-label*="追蹤"]',
            '[aria-label*="Follow"]',
        ];
        let followLocated = false;
        for (const sel of followSelectors) {
            const el = activePage.locator(sel).first();
            const count = await el.count();
            if (count > 0) {
                followLocated = true;
                // 滾動到按鈕讓使用者看到（不點擊）
                await el.scrollIntoViewIfNeeded().catch(() => { });
                console.log(`[Execute] 已定位追蹤按鈕: ${sel}`);
                break;
            }
        }
        activeSession.status = 'ready';
        activeSession.followLocated = followLocated;
        console.log(`[Execute] 準備完成，等待使用者確認送出`);
    }
    catch (err) {
        console.error('[Execute] 執行失敗:', err.message);
        activeSession.status = 'error';
        activeSession.error = err.message;
        await closeSession();
    }
    return activeSession;
}
/**
 * 雷達模式執行：follow / comment / both
 * - follow: 開啟作者個人頁，定位追蹤按鈕
 * - comment: 同 startExecution
 * - both: 開啟貼文頁，填入留言 + 定位追蹤按鈕
 */
async function startRadarExecution(postId, draftId, postUrl, draftText, actionType, authorHandle) {
    if (activeBrowser)
        await closeSession();
    activeSession = {
        status: 'opening',
        postId,
        draftId,
        postUrl,
        draftText,
        startedAt: new Date(),
        actionType,
        authorHandle,
    };
    try {
        const contextOptions = {
            locale: 'zh-TW',
            timezoneId: 'Asia/Taipei',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 900 },
        };
        if (fs.existsSync(SESSION_FILE)) {
            const raw = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            raw.cookies = raw.cookies.map((c) => ({ ...c, sameSite: (0, utils_1.normalizeSameSite)(c.sameSite) }));
            contextOptions.storageState = raw;
        }
        activeBrowser = await playwright_1.chromium.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--lang=zh-TW', '--window-size=1280,900'],
        });
        const context = await activeBrowser.newContext(contextOptions);
        activePage = await context.newPage();
        const followSelectors = [
            'button[data-testid*="follow"]',
            'button:has-text("追蹤")',
            'button:has-text("Follow")',
            '[aria-label*="追蹤"]',
            '[aria-label*="Follow"]',
        ];
        const locateFollow = async () => {
            for (const sel of followSelectors) {
                const el = activePage.locator(sel).first();
                if (await el.count() > 0) {
                    await el.scrollIntoViewIfNeeded().catch(() => { });
                    console.log(`[Radar] 已定位追蹤按鈕: ${sel}`);
                    return true;
                }
            }
            return false;
        };
        if (actionType === 'follow') {
            // 開啟作者個人頁
            const cleanHandle = authorHandle.replace(/^@/, '');
            const profileUrl = `https://www.threads.com/@${cleanHandle}`;
            console.log(`[Radar] 開啟個人頁: ${profileUrl}`);
            await activePage.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await activePage.waitForTimeout(2500);
            activeSession.followLocated = await locateFollow();
        }
        else if (actionType === 'comment') {
            // 同現有留言流程
            console.log(`[Radar] 開啟貼文頁: ${postUrl}`);
            await activePage.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await activePage.waitForTimeout(2500);
            const commentSelectors = [
                'div[contenteditable="true"][data-lexical-editor]',
                'div[contenteditable="true"][aria-placeholder]',
                'div[contenteditable="true"]',
                'textarea[placeholder]',
            ];
            for (const sel of commentSelectors) {
                const el = activePage.locator(sel).first();
                if (await el.count() > 0) {
                    await el.click({ timeout: 5000 }).catch(() => { });
                    await activePage.waitForTimeout(300);
                    await activePage.keyboard.press('Control+a');
                    await activePage.waitForTimeout(150);
                    const lines1 = draftText.split('\n');
                    for (let i = 0; i < lines1.length; i++) {
                        if (lines1[i])
                            await activePage.keyboard.type(lines1[i], { delay: 25 });
                        if (i < lines1.length - 1) {
                            await activePage.keyboard.press('Shift+Enter');
                            await activePage.waitForTimeout(80);
                        }
                    }
                    console.log(`[Radar] 留言已填入`);
                    break;
                }
            }
        }
        else {
            // both：填留言 + 定位追蹤
            console.log(`[Radar] 開啟貼文頁（both）: ${postUrl}`);
            await activePage.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await activePage.waitForTimeout(2500);
            const commentSelectors = [
                'div[contenteditable="true"][data-lexical-editor]',
                'div[contenteditable="true"][aria-placeholder]',
                'div[contenteditable="true"]',
                'textarea[placeholder]',
            ];
            for (const sel of commentSelectors) {
                const el = activePage.locator(sel).first();
                if (await el.count() > 0) {
                    await el.click({ timeout: 5000 }).catch(() => { });
                    await activePage.waitForTimeout(300);
                    await activePage.keyboard.press('Control+a');
                    await activePage.waitForTimeout(150);
                    const lines2 = draftText.split('\n');
                    for (let i = 0; i < lines2.length; i++) {
                        if (lines2[i])
                            await activePage.keyboard.type(lines2[i], { delay: 25 });
                        if (i < lines2.length - 1) {
                            await activePage.keyboard.press('Shift+Enter');
                            await activePage.waitForTimeout(80);
                        }
                    }
                    console.log(`[Radar] 留言已填入（both）`);
                    break;
                }
            }
            activeSession.followLocated = await locateFollow();
        }
        activeSession.status = 'ready';
        console.log(`[Radar] 執行準備完成，等待使用者確認`);
    }
    catch (err) {
        console.error('[Radar] 執行失敗:', err.message);
        activeSession.status = 'error';
        activeSession.error = err.message;
        await closeSession();
    }
    return activeSession;
}
/**
 * 使用者確認已手動送出，記錄並關閉瀏覽器
 */
async function confirmExecution() {
    if (!activeSession)
        throw new Error('No active execution session');
    const { postId, draftId } = activeSession;
    activeSession.status = 'confirmed';
    await closeSession();
    return { postId, draftId };
}
/**
 * 取消執行，關閉瀏覽器
 */
async function cancelExecution() {
    await closeSession();
}
