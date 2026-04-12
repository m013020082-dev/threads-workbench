"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("../db/client");
const uuid_1 = require("uuid");
const trendsService_1 = require("../services/trendsService");
const agentPipeline_1 = require("../services/agentPipeline");
const threadsAuth_1 = require("../services/threadsAuth");
const antiSpamService_1 = require("../services/antiSpamService");
const cookiePublisher_1 = require("../services/cookiePublisher");
async function publishPost(content) {
    return (0, cookiePublisher_1.publishWithCookies)(content);
}
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════
// Publisher Accounts（轉接至 Cookie 帳號系統）
// ═══════════════════════════════════════════
// GET /api/pub/accounts — 轉接至 /api/auth/accounts
router.get('/accounts', async (_req, res) => {
    try {
        const accounts = await (0, threadsAuth_1.getAccounts)();
        res.json({ accounts, success: true });
    }
    catch (err) {
        res.status(500).json({ error: '取得帳號列表失敗' });
    }
});
// ═══════════════════════════════════════════
// Brand Profile
// ═══════════════════════════════════════════
// POST /api/pub/brand-profile/suggest — AI 一鍵建議品牌設定
router.post('/brand-profile/suggest', async (req, res) => {
    try {
        const { description, profile_mode = 'brand' } = req.body;
        if (!description?.trim())
            return res.status(400).json({ error: '請提供描述' });
        let systemPrompt;
        let userPrompt;
        if (profile_mode === 'persona') {
            systemPrompt = `你是人設策略顧問，擅長為 Threads 社群媒體建立吸引人的個人品牌人設。
請根據使用者描述，生成完整的人設設定，以 JSON 格式回應，不要有任何說明文字，直接輸出 JSON。`;
            userPrompt = `根據以下描述，幫我建立 Threads 發文人設，以 JSON 格式輸出：
{
  "persona_name": "人設姓名（中文名）",
  "occupation": "職業（具體一點）",
  "personality": "個性描述（2-3句，具體生動）",
  "catchphrase": "常用口頭禪（2-3個，用逗號分隔）",
  "lifestyle": "生活方式（2-3句）",
  "personal_background": "個人背景故事（3-5句，要有故事性）",
  "tone_description": "語氣風格（2-3句）",
  "keywords": "常聊話題關鍵字（5-8個，逗號分隔）",
  "target_audience": "主要讀者族群（具體描述）",
  "writing_directions": "發文風格方向（2-3句建議）",
  "example_post": "一則範例貼文（150字內，符合人設風格的 Threads 貼文）",
  "posting_notes": "發文注意事項（2-3條）"
}

使用者描述：${description.trim()}`;
        }
        else {
            systemPrompt = `你是品牌策略顧問，擅長為 Threads 社群媒體制定品牌內容策略。
請根據使用者描述，生成完整的品牌設定，以 JSON 格式回應，不要有任何說明文字，直接輸出 JSON。`;
            userPrompt = `根據以下描述，幫我填寫品牌設定，以 JSON 格式輸出：
{
  "brand_name": "品牌名稱",
  "industry": "產業類別（具體）",
  "tone_description": "語氣風格描述（2-3句，例如：親切幽默、專業但不失人味）",
  "keywords": "核心關鍵字（5-8個，逗號分隔）",
  "avoid_topics": "建議避免的話題（2-3項）",
  "target_audience": "目標受眾（具體描述，含年齡層、職業、痛點）",
  "writing_directions": "寫作方向建議（2-3句，具體說明內容策略）",
  "example_post": "一則範例貼文（150字內，符合品牌調性的 Threads 貼文）",
  "posting_notes": "產文備註（2-3條 AI 嚴格遵守的規則）"
}

品牌描述：${description.trim()}`;
        }
        const raw = await (0, agentPipeline_1.callMiniMax)(systemPrompt, userPrompt);
        // 解析 JSON
        let suggestion = {};
        try {
            const match = raw.match(/\{[\s\S]*\}/);
            if (match)
                suggestion = JSON.parse(match[0]);
        }
        catch {
            return res.status(500).json({ error: 'AI 回應解析失敗，請重試' });
        }
        res.json({ suggestion, success: true });
    }
    catch (err) {
        console.error('Brand suggest error:', err);
        res.status(500).json({ error: `AI 建議失敗: ${err.message}` });
    }
});
// GET /api/pub/brand-profile
router.get('/brand-profile', async (req, res) => {
    try {
        const { workspace_id } = req.query;
        const result = await (0, client_1.query)('SELECT * FROM brand_profiles WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1', [workspace_id]);
        res.json({ profile: result.rows[0] || null, success: true });
    }
    catch (err) {
        res.status(500).json({ error: '取得品牌設定失敗' });
    }
});
// POST /api/pub/brand-profile — upsert
router.post('/brand-profile', async (req, res) => {
    try {
        const { workspace_id, id, publisher_account_id, created_at, updated_at, ...fields } = req.body;
        if (!workspace_id)
            return res.status(400).json({ error: '缺少 workspace_id' });
        const profileId = id || (0, uuid_1.v4)();
        const existing = id
            ? await (0, client_1.query)('SELECT id FROM brand_profiles WHERE id = $1', [id])
            : await (0, client_1.query)('SELECT id FROM brand_profiles WHERE workspace_id = $1', [workspace_id]);
        const targetId = existing.rows[0]?.id || profileId;
        if (existing.rows.length > 0) {
            const setClause = Object.keys(fields)
                .map((k, i) => `${k} = $${i + 2}`)
                .join(', ');
            await (0, client_1.query)(`UPDATE brand_profiles SET ${setClause}, updated_at = NOW() WHERE id = $1`, [targetId, ...Object.values(fields)]);
        }
        else {
            const cols = ['id', 'workspace_id', 'publisher_account_id', ...Object.keys(fields)];
            const vals = [profileId, workspace_id, publisher_account_id || null, ...Object.values(fields)];
            await (0, client_1.query)(`INSERT INTO brand_profiles (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`, vals);
        }
        const result = await (0, client_1.query)('SELECT * FROM brand_profiles WHERE id = $1', [existing.rows[0]?.id || profileId]);
        res.json({ profile: result.rows[0], success: true });
    }
    catch (err) {
        console.error('Upsert brand profile error:', err);
        res.status(500).json({ error: '儲存品牌設定失敗' });
    }
});
// ═══════════════════════════════════════════
// Trending Topics
// ═══════════════════════════════════════════
// GET /api/pub/trending
router.get('/trending', async (req, res) => {
    try {
        const { workspace_id } = req.query;
        const result = await (0, client_1.query)('SELECT * FROM trending_topics WHERE workspace_id = $1 ORDER BY trend_score DESC, created_at DESC LIMIT 30', [workspace_id]);
        res.json({ topics: result.rows, success: true });
    }
    catch (err) {
        res.status(500).json({ error: '取得話題失敗' });
    }
});
// POST /api/pub/trending/fetch
router.post('/trending/fetch', async (req, res) => {
    try {
        const { workspace_id } = req.body;
        if (!workspace_id)
            return res.status(400).json({ error: '缺少 workspace_id' });
        // Get brand profile for AI fallback
        const profileRes = await (0, client_1.query)('SELECT * FROM brand_profiles WHERE workspace_id = $1 LIMIT 1', [workspace_id]);
        const profile = profileRes.rows[0];
        const topics = await (0, trendsService_1.fetchTrendingTopics)(profile ? {
            brand_name: profile.brand_name || '品牌',
            industry: profile.industry || '科技',
            target_audience: profile.target_audience || '台灣用戶',
        } : undefined);
        // Clear old topics and insert new ones
        await (0, client_1.query)('DELETE FROM trending_topics WHERE workspace_id = $1', [workspace_id]);
        const inserted = [];
        for (const t of topics) {
            const id = (0, uuid_1.v4)();
            const r = await (0, client_1.query)(`INSERT INTO trending_topics (id, workspace_id, source, title, description, trend_score, fetched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [id, workspace_id, t.source, t.title, t.description, t.trend_score, Date.now()]);
            inserted.push(r.rows[0]);
        }
        res.json({ topics: inserted, count: inserted.length, success: true });
    }
    catch (err) {
        console.error('Fetch trending error:', err);
        res.status(500).json({ error: '抓取話題失敗' });
    }
});
// ═══════════════════════════════════════════
// Compose & Publish
// ═══════════════════════════════════════════
// POST /api/pub/compose — AI 生成貼文內容
router.post('/compose', async (req, res) => {
    try {
        const { workspace_id, topic, publisher_account_id } = req.body;
        if (!topic)
            return res.status(400).json({ error: '缺少話題' });
        // Bug #17：限制 topic 長度，避免 AI API 超時或失敗
        if (typeof topic !== 'string' || topic.trim().length < 2 || topic.trim().length > 500) {
            return res.status(400).json({ error: 'topic 長度應為 2–500 字' });
        }
        const profileRes = await (0, client_1.query)('SELECT * FROM brand_profiles WHERE workspace_id = $1 LIMIT 1', [workspace_id]);
        const profile = profileRes.rows[0] || {
            profile_mode: 'brand', brand_name: '品牌', industry: '科技',
            tone_description: '親切自然', keywords: '', avoid_topics: '',
            target_audience: '台灣用戶', writing_directions: '', example_post: '', posting_notes: '',
        };
        const fakeTopic = { title: topic, description: '', source: 'manual', trend_score: 100 };
        const draft = await (0, agentPipeline_1.composeForTopic)(profile, fakeTopic);
        if (!draft)
            return res.status(500).json({ error: '內容生成失敗' });
        res.json({ content: draft.content, angle: draft.angle, risk_level: draft.risk_level, audit_notes: draft.audit_notes, success: true });
    }
    catch (err) {
        console.error('Compose error:', err);
        res.status(500).json({ error: 'AI 產文失敗' });
    }
});
// POST /api/pub/publish — 立即發布（Cookie 模式）
router.post('/publish', async (req, res) => {
    try {
        const { workspace_id, content: rawContent, draft_id } = req.body;
        if (!rawContent)
            return res.status(400).json({ error: '缺少貼文內容' });
        let content = rawContent;
        content = (0, antiSpamService_1.convertToTraditional)(content);
        const result = await publishPost(content);
        if (result.success) {
            await (0, client_1.query)(`INSERT INTO auto_post_history (id, workspace_id, publisher_account_id, content, threads_post_id, status, published_at)
         VALUES ($1,$2,NULL,$3,'','success',$4)`, [(0, uuid_1.v4)(), workspace_id, content, Date.now()]);
            if (draft_id) {
                await (0, client_1.query)('UPDATE auto_drafts SET status=$1, published_at=$2, updated_at=NOW() WHERE id=$3', ['published', Date.now(), draft_id]);
            }
            res.json({ success: true });
        }
        else {
            await (0, client_1.query)(`INSERT INTO auto_post_history (id, workspace_id, publisher_account_id, content, status, error_message, published_at)
         VALUES ($1,$2,NULL,$3,'failed',$4,$5)`, [(0, uuid_1.v4)(), workspace_id, content, result.error, Date.now()]);
            res.status(500).json({ error: result.error });
        }
    }
    catch (err) {
        console.error('Publish error:', err);
        res.status(500).json({ error: '發布失敗' });
    }
});
// POST /api/pub/schedule/batch — 批次建立一個月排程（AI 自動生成內容）
router.post('/schedule/batch', async (req, res) => {
    try {
        const { workspace_id, start_date, end_date, posts_per_day, hour_start = 9, hour_end = 21 } = req.body;
        if (!workspace_id || !start_date || !end_date || !posts_per_day) {
            return res.status(400).json({ error: '缺少必要參數：workspace_id, start_date, end_date, posts_per_day' });
        }
        if (posts_per_day < 1 || posts_per_day > 50) {
            return res.status(400).json({ error: 'posts_per_day 需介於 1–50' });
        }
        if (hour_start >= hour_end) {
            return res.status(400).json({ error: 'hour_start 需小於 hour_end' });
        }
        // 計算日期清單
        const start = new Date(start_date);
        const end = new Date(end_date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 0);
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
        if (diffDays > 31)
            return res.status(400).json({ error: '最多排程 31 天' });
        const totalSlots = diffDays * posts_per_day;
        if (totalSlots > 1500)
            return res.status(400).json({ error: `總篇數 ${totalSlots} 超過上限 1500` });
        // 取得品牌設定
        const profileRes = await (0, client_1.query)('SELECT * FROM brand_profiles WHERE workspace_id = $1 LIMIT 1', [workspace_id]);
        const profile = profileRes.rows[0] || {
            profile_mode: 'brand', brand_name: '品牌', industry: '科技',
            tone_description: '親切自然', keywords: '', avoid_topics: '',
            target_audience: '台灣用戶', writing_directions: '', example_post: '', posting_notes: '',
        };
        // 預先回應，背景生成並排程
        res.json({ message: `開始批次排程：${diffDays} 天 × ${posts_per_day} 篇 = ${totalSlots} 篇，正在後台生成中...`, total: totalSlots, success: true });
        // 背景執行
        (async () => {
            const scheduled = [];
            for (let d = 0; d < diffDays; d++) {
                const dayStart = new Date(start);
                dayStart.setDate(start.getDate() + d);
                // 在時間窗內隨機分配 posts_per_day 個時間點
                const minuteRange = (hour_end - hour_start) * 60;
                const slots = [];
                while (slots.length < posts_per_day) {
                    const randMin = Math.floor(Math.random() * minuteRange);
                    // 確保各時間點至少間隔 15 分鐘
                    if (slots.every(s => Math.abs(s - randMin) >= 15))
                        slots.push(randMin);
                }
                slots.sort((a, b) => a - b);
                for (const offsetMin of slots) {
                    const scheduledAt = new Date(dayStart);
                    scheduledAt.setHours(hour_start, offsetMin, 0, 0);
                    try {
                        // AI 生成內容
                        const aiTopics = await (0, trendsService_1.generateTopicsWithAI)({
                            brand_name: profile.brand_name || '品牌',
                            industry: profile.industry || '科技',
                            target_audience: profile.target_audience || '台灣用戶',
                        }, 1);
                        const topic = aiTopics[0] || { title: '今日分享', description: '', source: 'batch', trend_score: 50 };
                        const draft = await (0, agentPipeline_1.composeForTopic)(profile, topic);
                        const content = draft ? (0, antiSpamService_1.convertToTraditional)(draft.content) : `${topic.title}`;
                        await (0, client_1.query)(`INSERT INTO auto_scheduled_posts (id, workspace_id, publisher_account_id, content, scheduled_at)
               VALUES ($1,$2,NULL,$3,$4)`, [(0, uuid_1.v4)(), workspace_id, content, scheduledAt.getTime()]);
                        scheduled.push(scheduledAt.toISOString());
                    }
                    catch (err) {
                        console.error(`[BatchSchedule] 生成失敗 ${scheduledAt.toISOString()}:`, err);
                    }
                }
            }
            console.log(`[BatchSchedule] 完成，共建立 ${scheduled.length}/${totalSlots} 篇排程`);
        })();
    }
    catch (err) {
        console.error('Batch schedule error:', err);
        res.status(500).json({ error: '批次排程失敗' });
    }
});
// POST /api/pub/schedule
router.post('/schedule', async (req, res) => {
    try {
        const { workspace_id, content, scheduled_at } = req.body;
        if (!content || !scheduled_at)
            return res.status(400).json({ error: '缺少必要參數' });
        const id = (0, uuid_1.v4)();
        const result = await (0, client_1.query)(`INSERT INTO auto_scheduled_posts (id, workspace_id, publisher_account_id, content, scheduled_at)
       VALUES ($1,$2,NULL,$3,$4) RETURNING *`, [id, workspace_id, content, scheduled_at]);
        res.json({ post: result.rows[0], success: true });
    }
    catch (err) {
        res.status(500).json({ error: '排程失敗' });
    }
});
// ═══════════════════════════════════════════
// Scheduled Posts
// ═══════════════════════════════════════════
// GET /api/pub/scheduled
router.get('/scheduled', async (req, res) => {
    try {
        const { workspace_id } = req.query;
        const result = await (0, client_1.query)(`SELECT s.*, p.threads_username as account_name
       FROM auto_scheduled_posts s
       LEFT JOIN publisher_accounts p ON s.publisher_account_id = p.id
       WHERE s.workspace_id = $1 ORDER BY s.scheduled_at ASC`, [workspace_id]);
        res.json({ posts: result.rows, success: true });
    }
    catch (err) {
        res.status(500).json({ error: '取得排程失敗' });
    }
});
// DELETE /api/pub/scheduled/:id
router.delete('/scheduled/:id', async (req, res) => {
    try {
        await (0, client_1.query)("UPDATE auto_scheduled_posts SET status='cancelled', updated_at=NOW() WHERE id=$1", [req.params.id]);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: '取消排程失敗' });
    }
});
// ═══════════════════════════════════════════
// Post History
// ═══════════════════════════════════════════
// GET /api/pub/history
router.get('/history', async (req, res) => {
    try {
        const { workspace_id } = req.query;
        const result = await (0, client_1.query)(`SELECT h.*, p.threads_username as account_name
       FROM auto_post_history h
       LEFT JOIN publisher_accounts p ON h.publisher_account_id = p.id
       WHERE h.workspace_id = $1 ORDER BY h.published_at DESC LIMIT 50`, [workspace_id]);
        res.json({ history: result.rows, success: true });
    }
    catch (err) {
        res.status(500).json({ error: '取得發文歷史失敗' });
    }
});
// ═══════════════════════════════════════════
// AI Drafts
// ═══════════════════════════════════════════
// GET /api/pub/drafts
router.get('/drafts', async (req, res) => {
    try {
        const { workspace_id, status } = req.query;
        const conditions = ['d.workspace_id = $1'];
        const params = [workspace_id];
        if (status) {
            conditions.push(`d.status = $2`);
            params.push(status);
        }
        const result = await (0, client_1.query)(`SELECT d.*, p.threads_username as account_name
       FROM auto_drafts d
       LEFT JOIN publisher_accounts p ON d.publisher_account_id = p.id
       WHERE ${conditions.join(' AND ')} ORDER BY d.created_at DESC`, params);
        res.json({ drafts: result.rows, success: true });
    }
    catch (err) {
        res.status(500).json({ error: '取得草稿失敗' });
    }
});
// POST /api/pub/drafts/:id/publish
router.post('/drafts/:id/publish', async (req, res) => {
    try {
        const { content: overrideContent } = req.body;
        const draftRes = await (0, client_1.query)('SELECT * FROM auto_drafts WHERE id = $1', [req.params.id]);
        if (draftRes.rows.length === 0)
            return res.status(404).json({ error: '草稿不存在' });
        const draft = draftRes.rows[0];
        let content = overrideContent || draft.content;
        content = (0, antiSpamService_1.convertToTraditional)(content);
        const publishResult = await publishPost(content);
        if (publishResult.success) {
            await (0, client_1.query)('UPDATE auto_drafts SET status=$1, published_at=$2, content=$3, updated_at=NOW() WHERE id=$4', ['published', Date.now(), content, req.params.id]);
            await (0, client_1.query)(`INSERT INTO auto_post_history (id, workspace_id, publisher_account_id, content, threads_post_id, status, published_at)
         VALUES ($1,$2,NULL,$3,'','success',$4)`, [(0, uuid_1.v4)(), draft.workspace_id, content, Date.now()]);
            res.json({ success: true });
        }
        else {
            res.status(500).json({ error: publishResult.error });
        }
    }
    catch (err) {
        res.status(500).json({ error: '發布草稿失敗' });
    }
});
// POST /api/pub/drafts/:id/schedule — 排程今日隨機發文
router.post('/drafts/:id/schedule', async (req, res) => {
    try {
        const { scheduled_at, content: overrideContent } = req.body;
        if (!scheduled_at)
            return res.status(400).json({ error: '缺少 scheduled_at' });
        const draftRes = await (0, client_1.query)('SELECT * FROM auto_drafts WHERE id = $1', [req.params.id]);
        if (draftRes.rows.length === 0)
            return res.status(404).json({ error: '草稿不存在' });
        const draft = draftRes.rows[0];
        let content = (0, antiSpamService_1.convertToTraditional)(overrideContent || draft.content);
        const schedId = (0, uuid_1.v4)();
        await (0, client_1.query)(`INSERT INTO auto_scheduled_posts (id, workspace_id, publisher_account_id, content, scheduled_at)
       VALUES ($1,$2,NULL,$3,$4)`, [schedId, draft.workspace_id, content, scheduled_at]);
        await (0, client_1.query)("UPDATE auto_drafts SET status='approved', content=$1, updated_at=NOW() WHERE id=$2", [content, req.params.id]);
        res.json({ success: true, scheduled_at, scheduled_post_id: schedId });
    }
    catch (err) {
        res.status(500).json({ error: '排程草稿失敗' });
    }
});
// POST /api/pub/drafts/:id/reject
router.post('/drafts/:id/reject', async (req, res) => {
    try {
        await (0, client_1.query)("UPDATE auto_drafts SET status='rejected', updated_at=NOW() WHERE id=$1", [req.params.id]);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: '捨棄草稿失敗' });
    }
});
// DELETE /api/pub/drafts — delete all
router.delete('/drafts', async (req, res) => {
    try {
        const { workspace_id } = req.query;
        await (0, client_1.query)('DELETE FROM auto_drafts WHERE workspace_id = $1', [workspace_id]);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: '刪除草稿失敗' });
    }
});
// ═══════════════════════════════════════════
// AI Agent
// ═══════════════════════════════════════════
// POST /api/pub/agent/run
router.post('/agent/run', async (req, res) => {
    try {
        const { workspace_id, publisher_account_id } = req.body;
        if (!workspace_id)
            return res.status(400).json({ error: '缺少 workspace_id' });
        // Get brand profile
        const profileRes = await (0, client_1.query)('SELECT * FROM brand_profiles WHERE workspace_id = $1 LIMIT 1', [workspace_id]);
        if (profileRes.rows.length === 0)
            return res.status(400).json({ error: '請先設定品牌設定' });
        const profile = profileRes.rows[0];
        // 取得話題：DB 現有話題 + 即時生成的品牌相關話題
        const profileAny = profile;
        const maxDrafts = parseInt(profileAny.posts_per_day) || 3;
        const dbTopicsRes = await (0, client_1.query)('SELECT * FROM trending_topics WHERE workspace_id = $1 ORDER BY trend_score DESC LIMIT 20', [workspace_id]);
        // 即時生成品牌相關話題（生成 maxDrafts * 3 筆以確保有足夠話題通過相關性篩選）
        let brandTopics = [];
        try {
            const aiTopicList = await (0, trendsService_1.generateTopicsWithAI)({
                brand_name: profileAny.brand_name || '品牌',
                industry: profileAny.industry || '科技',
                target_audience: profileAny.target_audience || '台灣用戶',
            }, Math.min(maxDrafts, 10)); // 最多 10 個，count=10 經測試穩定可靠
            brandTopics = aiTopicList.map(t => ({ id: undefined, ...t }));
            console.log(`[Agent] AI 生成 ${brandTopics.length} 則品牌話題，目標產出 ${maxDrafts} 篇`);
        }
        catch (e) {
            console.warn('[Agent] AI 品牌話題生成失敗:', e);
        }
        // 合併：品牌話題優先，再加 DB 話題
        const allTopics = [...brandTopics, ...dbTopicsRes.rows];
        if (allTopics.length === 0) {
            return res.status(500).json({ error: '無法取得話題，請先至熱門話題頁面抓取' });
        }
        // Immediately return and run pipeline in background
        res.json({ message: `Agent 啟動，目標產出 ${maxDrafts} 篇草稿（並行處理中），請稍後查看草稿列表`, success: true });
        // Concurrency pool：同時跑 CONCURRENCY 條 pipeline，湊滿 maxDrafts 篇才停
        (async () => {
            const autoPostMode = profileAny.auto_post_mode || 'manual';
            const profileId = profileAny.id || null;
            const CONCURRENCY = Math.min(5, maxDrafts); // 最多 5 條並行，避免 API rate limit
            const successfulDrafts = [];
            let topicIndex = 0;
            console.log(`[Agent] 並行 ${CONCURRENCY} 條 pipeline，目標 ${maxDrafts} 篇（共 ${allTopics.length} 個話題）`);
            // Worker：不斷從 allTopics 拉話題，直到達到目標數量
            async function pipelineWorker() {
                while (topicIndex < allTopics.length) {
                    if (successfulDrafts.length >= maxDrafts)
                        break;
                    const i = topicIndex++; // JS 單執行緒，++ 是原子操作
                    const topic = allTopics[i];
                    try {
                        const draftOutput = await (0, agentPipeline_1.runPipelineForTopic)(profile, {
                            id: topic.id,
                            title: topic.title,
                            description: topic.description,
                            source: topic.source,
                            trend_score: topic.trend_score,
                        });
                        if (draftOutput && successfulDrafts.length < maxDrafts) {
                            successfulDrafts.push(draftOutput);
                            console.log(`[Agent] ✓ 草稿 ${successfulDrafts.length}/${maxDrafts}：${topic.title}`);
                        }
                    }
                    catch (err) {
                        console.error(`[Agent] ✗ 話題 "${topic.title}" 失敗:`, err);
                    }
                }
            }
            // 啟動 CONCURRENCY 條 worker 並等全部跑完
            await Promise.all(Array.from({ length: CONCURRENCY }, () => pipelineWorker()));
            // 儲存結果
            let generated = 0;
            for (const draftOutput of successfulDrafts.slice(0, maxDrafts)) {
                const autoPost = autoPostMode === 'auto';
                if (autoPost) {
                    let autoContent = (0, antiSpamService_1.convertToTraditional)(draftOutput.content);
                    const pubResult = await publishPost(autoContent);
                    const status = pubResult.success ? 'auto_published' : 'pending_review';
                    await (0, client_1.query)(`INSERT INTO auto_drafts (id, workspace_id, publisher_account_id, brand_profile_id, trend_topic_id, source_trend, relevance_score, angle, content, risk_level, audit_notes, status, threads_post_id, published_at)
             VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,'',$12)`, [(0, uuid_1.v4)(), workspace_id, profileId, draftOutput.trend_topic_id || null,
                        draftOutput.source_trend, draftOutput.relevance_score, draftOutput.angle,
                        draftOutput.content, draftOutput.risk_level, draftOutput.audit_notes, status,
                        pubResult.success ? Date.now() : 0]);
                    if (pubResult.success) {
                        await (0, client_1.query)(`INSERT INTO auto_post_history (id, workspace_id, publisher_account_id, content, threads_post_id, status, published_at)
               VALUES ($1,$2,NULL,$3,'','success',$4)`, [(0, uuid_1.v4)(), workspace_id, draftOutput.content, Date.now()]);
                    }
                }
                else {
                    await (0, client_1.query)(`INSERT INTO auto_drafts (id, workspace_id, publisher_account_id, brand_profile_id, trend_topic_id, source_trend, relevance_score, angle, content, risk_level, audit_notes, status)
             VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,'pending_review')`, [(0, uuid_1.v4)(), workspace_id, profileId, draftOutput.trend_topic_id || null,
                        draftOutput.source_trend, draftOutput.relevance_score, draftOutput.angle,
                        draftOutput.content, draftOutput.risk_level, draftOutput.audit_notes]);
                }
                generated++;
            }
            console.log(`[Agent] 完成，產出 ${generated}/${maxDrafts} 篇草稿`);
        })();
    }
    catch (err) {
        console.error('Agent run error:', err);
        res.status(500).json({ error: 'Agent 執行失敗' });
    }
});
// ═══════════════════════════════════════════
// Dashboard Stats
// ═══════════════════════════════════════════
// GET /api/pub/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const { workspace_id } = req.query;
        const [cookieAccounts, scheduled, recentHistory, pendingDrafts] = await Promise.all([
            (0, client_1.query)('SELECT id, name, username, is_active FROM accounts ORDER BY created_at ASC'),
            (0, client_1.query)("SELECT COUNT(*) as count FROM auto_scheduled_posts WHERE workspace_id = $1 AND status='pending'", [workspace_id]),
            (0, client_1.query)('SELECT * FROM auto_post_history WHERE workspace_id = $1 ORDER BY published_at DESC LIMIT 5', [workspace_id]),
            (0, client_1.query)("SELECT COUNT(*) as count FROM auto_drafts WHERE workspace_id = $1 AND status='pending_review'", [workspace_id]),
        ]);
        const activeAccount = cookieAccounts.rows.find((a) => a.is_active);
        res.json({
            stats: {
                account_count: cookieAccounts.rows.length,
                scheduled_count: parseInt(scheduled.rows[0]?.count || '0'),
                recent_post_count: recentHistory.rows.length,
                pending_draft_count: parseInt(pendingDrafts.rows[0]?.count || '0'),
                active_account: activeAccount?.name || null,
            },
            recent_history: recentHistory.rows,
            accounts: cookieAccounts.rows,
            success: true,
        });
    }
    catch (err) {
        res.status(500).json({ error: '取得總覽失敗' });
    }
});
exports.default = router;
