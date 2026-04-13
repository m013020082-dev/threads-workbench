"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchPosts = searchPosts;
const types_1 = require("../types");
const client_1 = require("../db/client");
const uuid_1 = require("uuid");
const threadsScraper_1 = require("./threadsScraper");
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
/** 模糊模式：用 MiniMax 擴展關鍵字到相關話題、同義詞、上下位詞 */
async function expandKeywordsFuzzy(keywords) {
    if (!MINIMAX_API_KEY || keywords.length === 0)
        return keywords;
    try {
        const res = await fetch('https://api.minimax.chat/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
            body: JSON.stringify({
                model: 'MiniMax-M2.7-Flash',
                messages: [{
                        role: 'user',
                        content: `你是 Threads 搜尋關鍵字擴展助手。模糊模式：列出與以下關鍵字「語意相關」的詞，包含同義詞、相關話題、常見用法、繁簡體變體，每個關鍵字最多擴展 4 個。
只回傳 JSON 陣列格式，例如：["詞1","詞2","詞3"]，不要其他說明。

關鍵字：${keywords.join('、')}`
                    }],
                max_tokens: 300,
                temperature: 0.5,
            }),
        });
        if (!res.ok)
            return keywords;
        const data = await res.json();
        let content = data.choices?.[0]?.message?.content || '[]';
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        const expanded = JSON.parse(content);
        const all = [...new Set([...keywords, ...expanded])];
        console.log(`[Search] 模糊擴展: ${keywords.join(',')} → ${all.join(', ')}`);
        return all;
    }
    catch (e) {
        console.warn('[Search] 關鍵字擴展失敗，使用原始關鍵字:', e);
        return keywords;
    }
}
const REGION_TW = 'TW';
function timeRangeToMs(range) {
    const map = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 };
    return map[range] || 86400000;
}
async function searchPosts(params) {
    const cutoff = new Date(Date.now() - timeRangeToMs(params.time_range));
    // 關鍵字為空 → 直接查 DB（適用互追雷達不限主題的場景）
    if (!params.keywords || params.keywords.length === 0) {
        console.log(`[Search] 無關鍵字，直接從 DB 撈取 workspace ${params.workspace_id} 近期貼文`);
        const dbRes = await (0, client_1.query)(`SELECT * FROM posts WHERE workspace_id = $1 AND created_at >= $2
       AND status NOT IN ('SKIPPED','POSTED')
       ORDER BY score DESC, created_at DESC
       LIMIT 100`, [params.workspace_id, cutoff]);
        console.log(`[Search] DB 回傳 ${dbRes.rows.length} 篇（無關鍵字模式）`);
        return { posts: dbRes.rows, expandedKeywords: [] };
    }
    const isFuzzy = params.search_mode !== 'precise';
    // 擴展詞只用於評分/過濾，爬蟲只跑原始關鍵字（避免爬取時間過長）
    const expandedKeywords = isFuzzy
        ? await expandKeywordsFuzzy(params.keywords)
        : params.keywords;
    console.log(`[Search] 模式: ${isFuzzy ? '模糊' : '精準'}，爬取關鍵字: ${params.keywords.join(', ')}，擴展詞: ${expandedKeywords.join(', ')}，範圍: ${params.time_range}`);
    let scraped = [];
    try {
        // 爬蟲只用原始關鍵字，控制時間（最多 18 秒）
        scraped = await (0, threadsScraper_1.scrapeThreadsPosts)(params.keywords, params.workspace_id, params.time_range, 100, 40000);
        if (scraped.length === 0) {
            console.warn('[Search] 爬蟲回傳 0 篇，嘗試從 DB 取得現有真實貼文');
            let existingRes = await (0, client_1.query)(`SELECT * FROM posts WHERE workspace_id = $1 AND created_at >= $2
         AND post_url LIKE 'https://www.threads.com/%'
         AND post_text ~ '[\u4e00-\u9fff\u3400-\u4dbf]'
         AND status NOT IN ('SKIPPED','POSTED') ORDER BY created_at DESC LIMIT 50`, [params.workspace_id, cutoff]);
            if (existingRes.rows.length === 0) {
                existingRes = await (0, client_1.query)(`SELECT * FROM posts WHERE workspace_id = $1
           AND post_url LIKE 'https://www.threads.com/%'
           AND post_text ~ '[\u4e00-\u9fff\u3400-\u4dbf]'
           AND status NOT IN ('SKIPPED','POSTED') ORDER BY created_at DESC LIMIT 50`, [params.workspace_id]);
            }
            if (existingRes.rows.length > 0) {
                console.log(`[Search] 使用 DB 現有 ${existingRes.rows.length} 篇真實貼文`);
                scraped = existingRes.rows;
            }
            else {
                console.warn('[Search] 無真實貼文資料，請確認爬蟲帳號是否正常登入');
            }
        }
    }
    catch (err) {
        console.error('[Search] Playwright 爬蟲失敗:', err);
    }
    console.log(`[Search] 爬到 ${scraped.length} 篇，cutoff: ${cutoff.toISOString()}`);
    for (const p of scraped) {
        const mediaId = p.threads_media_id || null;
        await (0, client_1.query)(`INSERT INTO posts (id, workspace_id, author_handle, author_followers, author_location,
       post_url, post_text, created_at, like_count, comment_count, score, status, region, threads_media_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (post_url) DO UPDATE SET threads_media_id = COALESCE(EXCLUDED.threads_media_id, posts.threads_media_id)`, [p.id, p.workspace_id, p.author_handle, p.author_followers, p.author_location || '',
            p.post_url, p.post_text, p.created_at, p.like_count, p.comment_count,
            p.score, p.status, p.region, mediaId]);
    }
    // 只排除使用者已明確略過或已回覆的貼文，DRAFTED/APPROVED 仍顯示讓使用者繼續操作
    const conditions = [
        'workspace_id = $1',
        'created_at >= $2',
        `status NOT IN ('SKIPPED','POSTED')`,
        `post_text ~ '[\u4e00-\u9fff\u3400-\u4dbf]'`,
    ];
    const queryParams = [params.workspace_id, cutoff];
    let idx = 3;
    if (params.follower_min > 0) {
        conditions.push(`author_followers >= $${idx++}`);
        queryParams.push(params.follower_min);
    }
    if (params.follower_max > 0) {
        conditions.push(`author_followers <= $${idx++}`);
        queryParams.push(params.follower_max);
    }
    if (params.engagement_threshold > 0) {
        conditions.push(`(like_count + comment_count) >= $${idx++}`);
        queryParams.push(params.engagement_threshold);
    }
    // 精準模式：只回傳 text 包含任一原始關鍵字的貼文
    if (!isFuzzy && params.keywords.length > 0) {
        const kwConditions = params.keywords.map(() => `post_text ILIKE $${idx++}`);
        conditions.push(`(${kwConditions.join(' OR ')})`);
        params.keywords.forEach(kw => queryParams.push(`%${kw}%`));
    }
    let dbRes = await (0, client_1.query)(`SELECT * FROM posts WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`, queryParams);
    // 若指定時間範圍內無結果，自動擴大到全部時間（忽略 created_at，重新建 params）
    if (dbRes.rows.length === 0) {
        console.warn('[Search] 指定時間範圍無結果，自動擴大查詢時間範圍');
        const fbParams = [params.workspace_id];
        const fbConds = [`workspace_id = $1`, `status NOT IN ('SKIPPED','POSTED')`, `post_text ~ '[\u4e00-\u9fff\u3400-\u4dbf]'`];
        let fi = 2;
        if (params.follower_min > 0) {
            fbConds.push(`author_followers >= $${fi++}`);
            fbParams.push(params.follower_min);
        }
        if (params.follower_max > 0) {
            fbConds.push(`author_followers <= $${fi++}`);
            fbParams.push(params.follower_max);
        }
        if (params.engagement_threshold > 0) {
            fbConds.push(`(like_count + comment_count) >= $${fi++}`);
            fbParams.push(params.engagement_threshold);
        }
        if (!isFuzzy && params.keywords.length > 0) {
            fbConds.push(`(${params.keywords.map(() => `post_text ILIKE $${fi++}`).join(' OR ')})`);
            params.keywords.forEach(kw => fbParams.push(`%${kw}%`));
        }
        dbRes = await (0, client_1.query)(`SELECT * FROM posts WHERE ${fbConds.join(' AND ')} ORDER BY created_at DESC LIMIT 100`, fbParams);
    }
    const posts = dbRes.rows;
    console.log(`[Search] DB 累積共 ${posts.length} 篇（含篩選，模式: ${isFuzzy ? '模糊' : '精準'}）`);
    return { posts, expandedKeywords };
}
// 台灣地區 fallback mock 資料
const TW_POST_TEMPLATES = [
    '最近在研究 {kw}，發現台灣這塊市場其實很有潛力，大家有沒有相關經驗可以分享？',
    '老實說，{kw} 這個議題在台灣討論度還不夠高，但國外已經很火了 🔥',
    '跟大家報告一下我用 {kw} 三個月的心得，真的改變了我的工作方式',
    '台灣的 {kw} 生態系還在起步，但感覺今年會爆發，你們怎麼看？',
    '請問有人在台灣做 {kw} 相關的工作嗎？想交流一下 🙋',
    '分享一篇關於 {kw} 的觀察：台灣和日本、韓國的發展路徑差很多',
    '今天參加了 {kw} 的 meetup，台灣社群真的很活躍！',
    '有沒有人覺得 {kw} 在台灣的應用場景跟歐美完全不同？',
    '我對 {kw} 的熱情快熄滅了，有人也這樣嗎？還是只有我...',
    '工作用到 {kw} 已經兩年了，分享幾個台灣職場的實際案例',
    '{kw} 新手來問問題：台灣有哪些好的學習資源？感謝大家！',
    '今年台灣 {kw} 產業報告出爐，數據很有意思，大家來討論',
    '身為在台灣做 {kw} 的人，我覺得最大的挑戰是...',
    '從台北到高雄，{kw} 的發展差異比我想像中大很多',
    '{kw} 這個東西真的值得台灣人重視，理由有三個：',
];
const TW_HANDLES = [
    '@陳小明_台北', '@林創業家', '@黃科技控', '@taipei_techie', '@tw_startup_lens',
    '@digital_tw', '@廖產品人', '@alicewang_tw', '@台灣AI觀察', '@mark_hsinchu',
    '@ntu_grad_2022', '@taiwan_maker', '@苗栗有科技', '@jason_taipei', '@kaohsiung_dev',
];
const TW_LOCATIONS = [
    '台北市', '新北市', '桃園市', '台中市', '台南市',
    '高雄市', '新竹市', '新竹縣', '苗栗縣', '台灣',
];
function generateMockTwPosts(keywords, workspaceId, count = 15, timeRangeMs = 86400000) {
    return Array.from({ length: count }, (_, i) => {
        const kw = keywords[i % keywords.length] || '科技';
        const template = TW_POST_TEMPLATES[i % TW_POST_TEMPLATES.length].replace(/{kw}/g, kw);
        return {
            id: (0, uuid_1.v4)(),
            workspace_id: workspaceId,
            author_handle: TW_HANDLES[i % TW_HANDLES.length],
            author_followers: Math.floor(Math.random() * 80000) + 300,
            author_location: TW_LOCATIONS[i % TW_LOCATIONS.length],
            post_url: `https://www.threads.net/user/post/${(0, uuid_1.v4)().substring(0, 8)}`,
            post_text: template,
            // 確保在選定的時間範圍內
            created_at: new Date(Date.now() - Math.random() * timeRangeMs * 0.9),
            like_count: Math.floor(Math.random() * 800) + 5,
            comment_count: Math.floor(Math.random() * 80) + 1,
            score: 0,
            status: types_1.PostStatus.DISCOVERED,
            region: REGION_TW,
        };
    });
}
