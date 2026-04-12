"use strict";
/**
 * Threads 台灣地區貼文爬蟲
 * 使用 Playwright + session cookies 爬取 threads.com 搜尋結果
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeThreadsPosts = scrapeThreadsPosts;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const threadsAuth_1 = require("./threadsAuth");
const THREADS_SEARCH_BASE = 'https://www.threads.com/search';
const REGION = 'TW';
/** 將相對時間或 ISO datetime 轉為 Date */
function parsePostTime(raw) {
    if (!raw)
        return new Date();
    // ISO datetime（來自 <time datetime="...">）
    if (raw.includes('T') || raw.includes('-')) {
        const d = new Date(raw);
        if (!isNaN(d.getTime()))
            return d;
    }
    const now = Date.now();
    // 英文相對時間：1m, 2h, 3d, 1w
    const enMatch = raw.match(/^(\d+)([mhdw])$/i);
    if (enMatch) {
        const n = parseInt(enMatch[1]);
        const unit = enMatch[2].toLowerCase();
        const ms = { m: 60000, h: 3600000, d: 86400000, w: 604800000 };
        return new Date(now - n * (ms[unit] || 0));
    }
    // 中文相對時間：X分鐘前、X小時前、X天前、X週前、X個月前、X年前
    const zhMatch = raw.match(/(\d+)\s*(分鐘?|小時|天|週|周|個?月|年)/);
    if (zhMatch) {
        const n = parseInt(zhMatch[1]);
        const unit = zhMatch[2];
        const ms = {
            '分': 60000, '分鐘': 60000,
            '小時': 3600000,
            '天': 86400000,
            '週': 604800000, '周': 604800000,
            '月': 2592000000, '個月': 2592000000,
            '年': 31536000000,
        };
        const key = Object.keys(ms).find(k => unit.includes(k)) || '';
        return new Date(now - n * (ms[key] || 0));
    }
    return new Date();
}
function parseNum(s) {
    if (!s)
        return 0;
    const clean = s.replace(/,/g, '').trim();
    if (clean.includes('萬'))
        return Math.round(parseFloat(clean) * 10000);
    if (clean.includes('千'))
        return Math.round(parseFloat(clean) * 1000);
    if (/k/i.test(clean))
        return Math.round(parseFloat(clean) * 1000);
    if (/m/i.test(clean))
        return Math.round(parseFloat(clean) * 1000000);
    return parseInt(clean) || 0;
}
function scrollCountForRange(timeRange) {
    const map = { '1h': 4, '6h': 6, '24h': 8, '7d': 12 };
    return map[timeRange] ?? 6;
}
async function scrapeThreadsPosts(keywords, workspaceId, timeRange = '24h', maxResults = 30, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    const { browser, context } = await (0, threadsAuth_1.createAuthenticatedContext)();
    const allPosts = [];
    const seenUrls = new Set();
    // shortcode → threads media ID（從 API 回應攔截）
    const mediaIdMap = new Map();
    try {
        const page = await context.newPage();
        // 攔截 Threads 內部 API 回應，提取真實 media ID
        page.on('response', async (response) => {
            const url = response.url();
            if (!url.includes('threads.net') && !url.includes('instagram.com'))
                return;
            if (!url.includes('graphql') && !url.includes('/api/v1/'))
                return;
            try {
                const text = await response.text();
                // 從 JSON 回應中找 shortcode → pk (numeric ID) 的對應
                const shortcodeMatches = text.matchAll(/"code"\s*:\s*"([A-Za-z0-9_-]{10,12})"/g);
                const pkMatches = [...text.matchAll(/"pk"\s*:\s*"(\d{15,20})"/g)];
                let pkIdx = 0;
                for (const m of shortcodeMatches) {
                    const shortcode = m[1];
                    if (pkIdx < pkMatches.length) {
                        mediaIdMap.set(shortcode, pkMatches[pkIdx][1]);
                        pkIdx++;
                    }
                }
                // 也嘗試直接配對 id + code 在同一物件裡
                const objectMatches = text.matchAll(/"id"\s*:\s*"(\d{15,20})"[^}]{0,200}"code"\s*:\s*"([A-Za-z0-9_-]{10,12})"/g);
                for (const m of objectMatches) {
                    mediaIdMap.set(m[2], m[1]);
                }
                const objectMatches2 = text.matchAll(/"code"\s*:\s*"([A-Za-z0-9_-]{10,12})"[^}]{0,200}"id"\s*:\s*"(\d{15,20})"/g);
                for (const m of objectMatches2) {
                    mediaIdMap.set(m[1], m[2]);
                }
            }
            catch { }
        });
        for (const keyword of keywords) {
            if (allPosts.length >= maxResults)
                break;
            if (Date.now() >= deadline) {
                console.warn('[Scraper] 已達超時限制，提前結束');
                break;
            }
            try {
                console.log(`[Scraper] 搜尋關鍵字: ${keyword}`);
                const remaining = deadline - Date.now();
                if (remaining <= 2000)
                    break;
                const searchUrl = `${THREADS_SEARCH_BASE}?q=${encodeURIComponent(keyword)}&serp_type=default`;
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(remaining - 1000, 15000) });
                await page.waitForTimeout(1500);
                // 偵測是否跳到登入頁面（Cookie 失效）
                const currentUrl = page.url();
                const pageTitle = await page.title();
                const isLoginWall = currentUrl.includes('/login') || currentUrl.includes('/accounts/login')
                    || pageTitle.includes('Log in') || pageTitle.includes('登入')
                    || await page.locator('input[name="username"], input[type="password"]').count().then(n => n > 0).catch(() => false);
                if (isLoginWall) {
                    console.error('[Scraper] 偵測到登入牆，Cookie 已失效！請到帳號管理更新 Cookie。');
                    throw new Error('COOKIE_EXPIRED: Threads 登入 Cookie 已失效，請在帳號管理貼上最新 Cookie 後重試');
                }
                // 依時間範圍決定捲動次數（範圍越大，捲越多來取得更舊的貼文）
                const scrollCount = scrollCountForRange(timeRange);
                for (let i = 0; i < scrollCount; i++) {
                    if (Date.now() >= deadline - 2000)
                        break;
                    await page.evaluate(() => window.scrollBy(0, 1200));
                    await page.waitForTimeout(500);
                }
                // 擷取貼文
                const scraped = await page.evaluate(() => {
                    const results = [];
                    const seen = new Set();
                    // 找所有貼文連結（排除 /media 連結）
                    const postLinks = Array.from(document.querySelectorAll('a[href*="/post/"]'))
                        .filter(a => {
                        const href = a.getAttribute('href') || '';
                        return href.includes('/post/') && !href.includes('/media') && !href.includes('/activity');
                    });
                    postLinks.forEach((link) => {
                        const href = link.getAttribute('href') || '';
                        if (!href)
                            return;
                        const fullUrl = href.startsWith('http') ? href : `https://www.threads.com${href}`;
                        if (seen.has(fullUrl))
                            return;
                        seen.add(fullUrl);
                        // 作者帳號
                        const handleMatch = href.match(/\/@([^/]+)\//);
                        if (!handleMatch)
                            return;
                        const handle = `@${handleMatch[1]}`;
                        // 找文字容器（innerText > 60，用於抓貼文主文）
                        let container = link.parentElement;
                        for (let i = 0; i < 8; i++) {
                            if (!container)
                                break;
                            if (container.innerText?.length > 60)
                                break;
                            container = container.parentElement;
                        }
                        if (!container)
                            return;
                        const rawText = container.innerText || '';
                        if (rawText.length < 20)
                            return;
                        // 從 innerText 解析貼文內容和互動數
                        const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
                        // 找相對時間（如 1h、2d、3w、5m、1年前 等）
                        const timeMatch = rawText.match(/(\d+\s*[分鐘時天週周月年]前?|\d+[mhdw])\b/i);
                        const relative_time = timeMatch ? timeMatch[0].trim() : '';
                        // 從 link 往上找最近的 <time datetime>（貼文本身的發文時間）
                        // 不往上爬太多層，避免跑到「被回覆的舊文」的時間
                        let datetimeAttr = '';
                        let timeSearchEl = link;
                        for (let i = 0; i < 8 && timeSearchEl; i++) {
                            const t = timeSearchEl.querySelector('time[datetime]');
                            if (t) {
                                datetimeAttr = t.getAttribute('datetime') || '';
                                break;
                            }
                            timeSearchEl = timeSearchEl.parentElement;
                        }
                        // 找到貼文主文（排除日期行、數字行、handle 行、短時間行）
                        const textLines = lines.filter((l) => l.length > 15 &&
                            !l.match(/^\d{4}-\d{1,2}-\d{1,2}$/) &&
                            !l.match(/^[\d,.萬千kKmM]+$/) &&
                            !l.startsWith('@') &&
                            !l.match(/^[0-9]+$/) &&
                            !l.match(/^\d+[mhdw]$/));
                        const postText = textLines.slice(0, 5).join(' ').trim();
                        if (!postText || postText.length < 15)
                            return;
                        // 找數字行作為互動數
                        const nums = lines
                            .filter((l) => l.match(/^[\d,.]+$/) || l.match(/^[\d,.]+[萬千kKmM]$/))
                            .map((l) => parseInt(l.replace(/[^0-9]/g, '')) || 0);
                        results.push({
                            handle,
                            post_text: postText.substring(0, 500),
                            post_url: fullUrl,
                            like_count: nums[0] || 0,
                            comment_count: nums[1] || 0,
                            relative_time: datetimeAttr || relative_time,
                        });
                    });
                    return results;
                });
                console.log(`[Scraper] 關鍵字 "${keyword}" 解析到 ${scraped.length} 篇`);
                for (const p of scraped) {
                    if (allPosts.length >= maxResults)
                        break;
                    if (!p.post_text || !p.handle)
                        continue;
                    if (seenUrls.has(p.post_url))
                        continue;
                    seenUrls.add(p.post_url);
                    // 從 URL 取出 shortcode，查攔截到的真實 media ID
                    const shortcodeMatch = p.post_url.match(/\/post\/([A-Za-z0-9_-]+)/);
                    const shortcode = shortcodeMatch ? shortcodeMatch[1] : null;
                    const threadsMediaId = shortcode ? (mediaIdMap.get(shortcode) || null) : null;
                    allPosts.push({
                        id: (0, uuid_1.v4)(),
                        workspace_id: workspaceId,
                        author_handle: p.handle,
                        author_followers: 0,
                        author_location: '台灣',
                        post_url: p.post_url,
                        post_text: p.post_text,
                        created_at: parsePostTime(p.relative_time),
                        like_count: p.like_count,
                        comment_count: p.comment_count,
                        score: 0,
                        status: types_1.PostStatus.DISCOVERED,
                        region: REGION,
                        threads_media_id: threadsMediaId,
                    });
                }
            }
            catch (err) {
                console.error(`[Scraper] 關鍵字 "${keyword}" 失敗:`, err);
            }
        }
        await page.close();
    }
    finally {
        await context.close();
        await browser.close();
    }
    console.log(`[Scraper] 共爬取 ${allPosts.length} 篇貼文`);
    return allPosts;
}
