/**
 * Threads Cookie-based Publisher
 * 使用 Playwright + Cookie 發布貼文，無需官方 API Token
 */

import { chromium, Browser } from 'playwright';
import { getActiveAccount } from './threadsAuth';
import { normalizeSameSite } from '../utils';

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

    console.log(`[CookiePublisher] 開啟貼文頁面準備回覆: ${postUrl}`);
    let httpStatus = 200;
    page.on('response', res => {
      if (res.url().startsWith('https://www.threads.com') && res.request().resourceType() === 'document') {
        httpStatus = res.status();
      }
    });
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
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

    // 步驟一：點擊原貼文的「回覆」圖示，觸發輸入框出現
    // Threads 的輸入框不是預設顯示，需先點擊 svg[aria-label="回覆"] 才會展開
    const replyIconClicked = await (async () => {
      const el = page.locator('svg[aria-label="回覆"]').first();
      if (await el.count() > 0) {
        await el.click({ timeout: 5000 });
        console.log(`[CookiePublisher] 點擊回覆圖示`);
        return true;
      }
      // 備用：英文介面
      const elEn = page.locator('svg[aria-label="Reply"]').first();
      if (await elEn.count() > 0) {
        await elEn.click({ timeout: 5000 });
        console.log(`[CookiePublisher] 點擊 Reply 圖示（英文介面）`);
        return true;
      }
      return false;
    })().catch(() => false);

    if (!replyIconClicked) {
      console.warn(`[CookiePublisher] 找不到回覆圖示`);
    }

    // 步驟二：等待 contenteditable 輸入框出現並填入內容
    let filled = false;
    try {
      await page.waitForSelector('div[contenteditable="true"][data-lexical-editor="true"]', { timeout: 6000 });
      const el = page.locator('div[contenteditable="true"][data-lexical-editor="true"]').first();
      await el.click({ timeout: 3000 });
      await page.waitForTimeout(300);
      await page.keyboard.type(draftText, { delay: 30 });
      filled = true;
      console.log(`[CookiePublisher] 已填入回覆內容（${draftText.length} 字）`);
    } catch {
      // 備用：嘗試任何 contenteditable
      try {
        await page.waitForSelector('div[contenteditable="true"]', { timeout: 4000 });
        const el = page.locator('div[contenteditable="true"]').first();
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(300);
        await page.keyboard.type(draftText, { delay: 30 });
        filled = true;
        console.log(`[CookiePublisher] 備用 selector 已填入回覆內容`);
      } catch {
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
