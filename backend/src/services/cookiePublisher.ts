/**
 * Threads Cookie-based Publisher
 * 使用 Playwright + Cookie 發布貼文，無需官方 API Token
 */

import { chromium, Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getActiveAccount, createAuthenticatedContext } from './threadsAuth';
import { normalizeSameSite } from '../utils';

const SESSION_FILE = path.join(process.cwd(), 'threads-session.json');

/** 取得有效的 storageState：優先用 DB 帳號，fallback 到 threads-session.json */
async function getStorageState(): Promise<object | null> {
  // 優先：資料庫帳號（帳號管理設定的，最新有效）
  const acc = await getActiveAccount();
  if (acc?.session_data) {
    try {
      const raw = typeof acc.session_data === 'string' ? JSON.parse(acc.session_data) : acc.session_data;
      raw.cookies = raw.cookies.map((c: any) => ({ ...c, sameSite: normalizeSameSite(c.sameSite) }));
      console.log(`[CookiePublisher] 使用 DB 帳號「${acc.name}」session`);
      return raw;
    } catch {}
  }
  // Fallback：threads-session.json
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      raw.cookies = raw.cookies.map((c: any) => ({ ...c, sameSite: normalizeSameSite(c.sameSite) }));
      console.log(`[CookiePublisher] 使用 threads-session.json`);
      return raw;
    } catch {}
  }
  return null;
}

export interface CookiePublishResult {
  success: boolean;
  error?: string;
}

/**
 * 使用 Cookie 帳號發布 Threads 貼文
 * 透過 intent URL 開啟發文對話框並自動點擊發佈
 */
/**
 * 使用 Cookie 帳號直接回覆（留言）Threads 貼文，全程 headless
 */
export async function replyWithCookies(postUrl: string, draftText: string): Promise<CookiePublishResult> {
  let browser: Browser | null = null;
  try {
    const { browser: b, context } = await createAuthenticatedContext();
    browser = b;
    const page = await context.newPage();

    console.log(`[CookiePublisher] 開啟貼文頁面準備回覆: ${postUrl}`);
    let httpStatus = 200;
    page.on('response', res => {
      if (res.url().startsWith('https://www.threads.com') && res.request().resourceType() === 'document') {
        httpStatus = res.status();
      }
    });
    // 先暖機載入首頁讓 SPA 初始化，再跳轉貼文頁（同 followWithCookies 修法）
    await page.goto('https://www.threads.com/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(4000);

    // 確認未被導向登入頁 or HTTP 5xx（通常是 cookie 失效）
    const currentUrl = page.url();
    const loginPatterns = ['/login', 'accounts/login', '/signin', '/auth'];
    if (loginPatterns.some(p => currentUrl.includes(p))) {
      return { success: false, error: 'Cookie 已失效，請重新匯出帳號 Cookie' };
    }
    if (httpStatus >= 500) {
      console.error(`[CookiePublisher] 頁面回傳 HTTP ${httpStatus}，Cookie 可能已失效`);
      return { success: false, error: `Cookie 已失效（HTTP ${httpStatus}），請重新匯出帳號 Cookie` };
    }

    console.log(`[CookiePublisher] 貼文頁 URL: ${page.url()}`);

    // 關閉可能出現的宣傳 Modal（同 followWithCookies）
    const closeSelectors = [
      'div[aria-label="關閉"]',
      'button[aria-label="關閉"]',
      '[aria-label="Close"]',
      'svg[aria-label="關閉"]',
    ];
    for (const sel of closeSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await el.click({ timeout: 2000 }).catch(() => {});
        console.log(`[CookiePublisher] 關閉 Modal: ${sel}`);
        await page.waitForTimeout(500);
        break;
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1500);

    // 步驟一：先嘗試直接找已顯示的輸入框（有些頁面直接展開）
    let inputEl = page.locator('div[contenteditable="true"][data-lexical-editor="true"]').first();
    if (await inputEl.count() === 0) {
      // 步驟二：點擊回覆圖示觸發展開（嘗試多種 selector）
      const replyIconSelectors = [
        'svg[aria-label="回覆"]',
        'svg[aria-label="Reply"]',
        '[aria-label="回覆"]',
        '[aria-label="Reply"]',
        'span[aria-label="回覆"]',
        'span[aria-label="Reply"]',
      ];
      let clicked = false;
      for (const sel of replyIconSelectors) {
        const el = page.locator(sel).first();
        if (await el.count() > 0) {
          await el.click({ timeout: 5000 }).catch(() => {});
          console.log(`[CookiePublisher] 點擊回覆圖示: ${sel}`);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        // 嘗試點「回覆」文字按鈕
        const replyBtnSelectors = [
          'div[role="button"]:has-text("回覆")',
          'button:has-text("回覆")',
          'div[role="button"]:has-text("Reply")',
          'button:has-text("Reply")',
        ];
        for (const sel of replyBtnSelectors) {
          const el = page.locator(sel).first();
          if (await el.count() > 0) {
            await el.click({ timeout: 5000 }).catch(() => {});
            console.log(`[CookiePublisher] 點擊回覆按鈕: ${sel}`);
            break;
          }
        }
      }
      await page.waitForTimeout(2000);
      inputEl = page.locator('div[contenteditable="true"][data-lexical-editor="true"]').first();
    }

    // 步驟三：填入內容
    let filled = false;
    const typeText = async (el: ReturnType<typeof page.locator>) => {
      await el.click({ timeout: 3000 });
      await page.waitForTimeout(300);
      for (let i = 0, lines = draftText.split('\n'); i < lines.length; i++) {
        if (lines[i]) await page.keyboard.type(lines[i], { delay: 30 });
        if (i < lines.length - 1) { await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(80); }
      }
    };

    try {
      await page.waitForSelector('div[contenteditable="true"][data-lexical-editor="true"]', { timeout: 6000 });
      await typeText(page.locator('div[contenteditable="true"][data-lexical-editor="true"]').first());
      filled = true;
      console.log(`[CookiePublisher] 已填入回覆內容（${draftText.length} 字）`);
    } catch {
      // 備用：嘗試任何 contenteditable
      try {
        await page.waitForSelector('div[contenteditable="true"]', { timeout: 4000 });
        await typeText(page.locator('div[contenteditable="true"]').first());
        filled = true;
        console.log(`[CookiePublisher] 備用 selector 已填入回覆內容`);
      } catch {
        await page.screenshot({ path: path.join(process.cwd(), 'reply_fail.png') }).catch(() => {});
        return { success: false, error: '找不到留言輸入框，請確認 Cookie 有效或重試' };
      }
    }

    await page.waitForTimeout(1000);

    // 點擊送出按鈕（Modal 右下角的「發佈」按鈕）
    const replyButtonSelectors = [
      'div[role="button"]:has-text("發佈")',
      'button:has-text("發佈")',
      'div[role="button"]:has-text("Post")',
      'button:has-text("Post")',
      '[data-testid="post-button"]',
    ];

    let clicked = false;
    for (const sel of replyButtonSelectors) {
      const els = page.locator(sel);
      if (await els.count() === 0) continue;

      const el = els.last();
      const ariaDisabled = await el.getAttribute('aria-disabled').catch(() => null);
      if (ariaDisabled === 'true') continue;

      await el.click({ timeout: 10000 });
      clicked = true;
      console.log(`[CookiePublisher] 點擊送出按鈕: ${sel}`);
      break;
    }

    if (!clicked) {
      return { success: false, error: '找不到送出按鈕，請確認 Cookie 有效或 Threads 介面是否更新' };
    }

    await page.waitForTimeout(3000);
    console.log(`[CookiePublisher] 回覆送出完成`);
    return { success: true };

  } catch (err: any) {
    console.error('[CookiePublisher] 回覆失敗:', err.message);
    return { success: false, error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Headless 追蹤用戶 — 開啟個人頁，點擊追蹤按鈕，全程背景執行
 */
export async function followWithCookies(authorHandle: string): Promise<CookiePublishResult> {
  let browser: Browser | null = null;
  try {
    const { browser: b, context } = await createAuthenticatedContext();
    browser = b;
    const page = await context.newPage();
    const cleanHandle = authorHandle.replace(/^@/, '');
    const profileUrl = `https://www.threads.com/@${cleanHandle}`;
    console.log(`[CookiePublisher] 開啟個人頁準備追蹤: ${profileUrl}`);
    // 先暖機載入首頁，讓 SPA 初始化，再跳轉個人頁
    await page.goto('https://www.threads.com/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const currentUrl = page.url();
    console.log(`[CookiePublisher] 當前 URL: ${currentUrl}`);
    if (['/login', 'accounts/login', '/signin', '/auth'].some(p => currentUrl.includes(p))) {
      return { success: false, error: 'Cookie 已失效，請重新匯出帳號 Cookie' };
    }

    // 關閉可能出現的宣傳 Modal（"透過 Threads 暢所欲言" 等）
    const closeSelectors = [
      'div[aria-label="關閉"]',
      'button[aria-label="關閉"]',
      '[aria-label="Close"]',
      'svg[aria-label="關閉"]',
      'div[role="button"][tabindex="0"]:has(svg)',
    ];
    for (const sel of closeSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await el.click({ timeout: 2000 }).catch(() => {});
        console.log(`[CookiePublisher] 關閉 Modal: ${sel}`);
        await page.waitForTimeout(500);
        break;
      }
    }
    // 也嘗試按 Escape 關閉
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);

    // 等待 SPA 路由完成 + 頁面內容渲染
    await page.waitForURL(`**/threads.com/@${cleanHandle}**`, { timeout: 10000 }).catch(() => {});
    // 再等 button 出現
    await page.waitForSelector('button, [role="button"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log(`[CookiePublisher] 路由後 URL: ${page.url()}`);

    // 截圖存到 backend 資料夾
    await page.screenshot({ path: path.join(process.cwd(), 'follow_debug.png') }).catch(() => {});

    // 列出頁面按鈕文字診斷
    const allBtnTexts = await page.locator('button, [role="button"]').allTextContents().catch(() => [] as string[]);
    const relevant = allBtnTexts.map(t => t?.trim()).filter(t => t && t.length > 0).slice(0, 20);
    console.log(`[CookiePublisher] 按鈕文字(${allBtnTexts.length}):`, relevant);

    // 尋找並點擊追蹤按鈕（跳過已追蹤狀態）
    const alreadyFollowedPhrases = ['追蹤中', '互追', 'Following', 'Unfollow', '正在追蹤'];
    const followSelectors = [
      'button:has-text("追蹤")',
      'div[role="button"]:has-text("追蹤")',
      'button:has-text("Follow")',
      'div[role="button"]:has-text("Follow")',
      '[aria-label*="追蹤"]',
      '[aria-label*="Follow"]',
    ];

    let clicked = false;
    for (const sel of followSelectors) {
      const els = page.locator(sel);
      const count = await els.count();
      for (let i = 0; i < count; i++) {
        const el = els.nth(i);
        const text = (await el.textContent().catch(() => '')) || '';
        if (alreadyFollowedPhrases.some(p => text.includes(p))) continue;
        await el.click({ timeout: 5000 });
        clicked = true;
        console.log(`[CookiePublisher] 已點擊追蹤按鈕 [${sel}]: "${text.trim()}"`);
        break;
      }
      if (clicked) break;
    }

    if (!clicked) {
      const isAlreadyFollowing = allBtnTexts.some(t => alreadyFollowedPhrases.some(p => t.includes(p)));
      if (isAlreadyFollowing) {
        console.log(`[CookiePublisher] 已追蹤 ${authorHandle}，略過`);
        return { success: true };
      }
      return { success: false, error: '找不到追蹤按鈕，可能已追蹤或 Threads 介面已更新' };
    }

    await page.waitForTimeout(2000);
    console.log(`[CookiePublisher] 追蹤完成: ${authorHandle}`);
    return { success: true };

  } catch (err: any) {
    console.error('[CookiePublisher] 追蹤失敗:', err.message);
    return { success: false, error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export async function publishWithCookies(content: string): Promise<CookiePublishResult> {
  const acc = await getActiveAccount();
  if (!acc?.session_data) {
    return { success: false, error: '尚未設定帳號，請先在帳號管理中新增 Cookie 帳號' };
  }

  let browser: Browser | null = null;
  try {
    const raw = typeof acc.session_data === 'string'
      ? JSON.parse(acc.session_data)
      : acc.session_data;

    raw.cookies = raw.cookies.map((c: any) => ({
      ...c,
      sameSite: normalizeSameSite(c.sameSite),
    }));

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=zh-TW',
        '--window-size=1280,900',
      ],
    });

    const context = await browser.newContext({
      storageState: raw,
      locale: 'zh-TW',
      timezoneId: 'Asia/Taipei',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });

    const page = await context.newPage();

    // 使用 intent URL 開啟帶有預填文字的發文對話框
    const intentUrl = `https://www.threads.com/intent/post?text=${encodeURIComponent(content)}`;
    console.log(`[CookiePublisher] 帳號「${acc.name}」開啟發文頁面...`);

    let publishHttpStatus = 200;
    page.on('response', res => {
      if (res.url().startsWith('https://www.threads.com') && res.request().resourceType() === 'document') {
        publishHttpStatus = res.status();
      }
    });
    await page.goto(intentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // 確認未被導向登入頁（Bug #12：涵蓋更多登入路徑）
    const currentUrl = page.url();
    const loginPatterns = ['/login', 'accounts/login', '/signin', '/auth'];
    if (loginPatterns.some(p => currentUrl.includes(p))) {
      return { success: false, error: 'Cookie 已失效，請重新匯出帳號 Cookie' };
    }
    if (publishHttpStatus >= 500) {
      return { success: false, error: `Cookie 已失效（HTTP ${publishHttpStatus}），請重新匯出帳號 Cookie` };
    }

    // 尋找並點擊「發佈 / Post」按鈕（多組 selector 以防 UI 更新）
    const postButtonSelectors = [
      'div[role="button"]:has-text("發佈")',
      'button:has-text("發佈")',
      'div[role="button"]:has-text("Post")',
      'button:has-text("Post")',
      '[data-testid="post-button"]',
      '[aria-label="發佈"]',
      '[aria-label="Post"]',
    ];

    let clicked = false;
    for (const sel of postButtonSelectors) {
      const els = page.locator(sel);
      const count = await els.count();
      if (count === 0) continue;

      const el = els.last();
      const ariaDisabled = await el.getAttribute('aria-disabled').catch(() => null);
      if (ariaDisabled === 'true') continue;

      await el.click({ timeout: 10000 });
      clicked = true;
      console.log(`[CookiePublisher] 點擊發佈按鈕: ${sel}`);
      break;
    }

    if (!clicked) {
      return { success: false, error: '找不到發佈按鈕，請確認 Cookie 有效或 Threads 介面是否更新' };
    }

    await page.waitForTimeout(3000);
    console.log(`[CookiePublisher] 發布完成，帳號：${acc.name}`);
    return { success: true };

  } catch (err: any) {
    console.error('[CookiePublisher] 發布失敗:', err.message);
    return { success: false, error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
