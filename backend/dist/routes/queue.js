"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("../db/client"); // reload
const router = (0, express_1.Router)();
function transformPost(row) {
    return {
        ...row,
        reply_count: row.comment_count || 0,
        repost_count: row.repost_count || 0,
        engagement_count: (row.like_count || 0) + (row.comment_count || 0),
        posted_at: row.created_at,
        score: row.score || 0,
    };
}
function transformDraft(row) {
    return {
        ...row,
        draft_text: row.text || row.draft_text || '',
        // Bug #5：統一使用 ';' 分隔符，與 drafts.ts 及 draftService 一致
        risk_warnings: Array.isArray(row.risk_warnings)
            ? row.risk_warnings
            : (row.risk_warnings || row.risk_notes || '').split(';').map((s) => s.trim()).filter(Boolean),
    };
}
// GET /api/queue?workspace_id=...
router.get('/', async (req, res) => {
    try {
        const { workspace_id } = req.query;
        if (!workspace_id)
            return res.status(400).json({ error: 'workspace_id required' });
        const result = await (0, client_1.query)(`SELECT p.*, json_agg(d.* ORDER BY d.created_at DESC) FILTER (WHERE d.id IS NOT NULL) as drafts
       FROM posts p
       LEFT JOIN drafts d ON d.post_id = p.id
       WHERE p.workspace_id = $1 AND p.status IN ('APPROVED','READY_FOR_REVIEW')
       GROUP BY p.id
       ORDER BY p.score DESC`, [workspace_id]);
        const queue = result.rows.map(row => ({
            ...transformPost(row),
            drafts: Array.isArray(row.drafts) ? row.drafts.map(transformDraft) : [],
        }));
        res.json({ queue, count: queue.length, success: true });
    }
    catch (err) {
        console.error('Queue fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch queue' });
    }
});
// POST /api/queue/add
router.post('/add', async (req, res) => {
    try {
        const { post_id } = req.body;
        if (!post_id)
            return res.status(400).json({ error: 'post_id required' });
        const result = await (0, client_1.query)("UPDATE posts SET status = 'READY_FOR_REVIEW' WHERE id = $1 RETURNING *", [post_id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Post not found' });
        res.json({ post: transformPost(result.rows[0]), success: true });
    }
    catch (err) {
        console.error('Add to queue error:', err);
        res.status(500).json({ error: 'Failed to add to queue' });
    }
});
// POST /api/queue/approve-all — 批次核准所有有草稿的貼文（選最佳草稿）
router.post('/approve-all', async (req, res) => {
    try {
        const { workspace_id } = req.body;
        if (!workspace_id)
            return res.status(400).json({ error: 'workspace_id required' });
        // 取得所有 DRAFTED / READY_FOR_REVIEW 且有草稿的貼文
        const postsRes = await (0, client_1.query)(`SELECT p.id as post_id, d.id as draft_id, d.similarity_score,
              array_length(d.risk_warnings, 1) as warning_count
       FROM posts p
       JOIN drafts d ON d.post_id = p.id AND d.approved = false
       WHERE p.workspace_id = $1 AND p.status IN ('APPROVED','READY_FOR_REVIEW')
       ORDER BY p.id, COALESCE(array_length(d.risk_warnings, 1), 0) ASC, d.similarity_score ASC`, [workspace_id]);
        // 每篇貼文選第一筆（最少警告、最低相似度）
        const seen = new Set();
        const toApprove = [];
        for (const row of postsRes.rows) {
            if (!seen.has(row.post_id)) {
                seen.add(row.post_id);
                toApprove.push({ postId: row.post_id, draftId: row.draft_id });
            }
        }
        let approved = 0;
        for (const { postId, draftId } of toApprove) {
            await (0, client_1.query)('UPDATE drafts SET approved = true WHERE id = $1', [draftId]);
            await (0, client_1.query)("UPDATE posts SET status = 'APPROVED' WHERE id = $1", [postId]);
            approved++;
        }
        res.json({ approved, success: true });
    }
    catch (err) {
        console.error('Approve-all error:', err);
        res.status(500).json({ error: 'Failed to approve all' });
    }
});
// POST /api/queue/batch-follow — 批次標記為建議追蹤
router.post('/batch-follow', async (req, res) => {
    try {
        const { post_ids } = req.body;
        if (!Array.isArray(post_ids) || post_ids.length === 0) {
            return res.status(400).json({ error: 'post_ids array required' });
        }
        const placeholders = post_ids.map((_, i) => `$${i + 1}`).join(',');
        await (0, client_1.query)(`UPDATE posts SET status = 'FOLLOW_SUGGESTED' WHERE id IN (${placeholders})`, post_ids);
        res.json({ updated: post_ids.length, success: true });
    }
    catch (err) {
        console.error('Batch-follow error:', err);
        res.status(500).json({ error: 'Failed to batch follow' });
    }
});
// POST /api/queue/clear — 清空佇列（將所有 SCORED/DRAFTED/APPROVED 標記為 SKIPPED）
router.post('/clear', async (req, res) => {
    try {
        const { workspace_id } = req.body;
        if (!workspace_id)
            return res.status(400).json({ error: 'workspace_id required' });
        const result = await (0, client_1.query)(`UPDATE posts SET status = 'SKIPPED'
       WHERE workspace_id = $1 AND status IN ('SCORED','DRAFTED','APPROVED','READY_FOR_REVIEW')`, [workspace_id]);
        res.json({ cleared: result.rowCount ?? 0, success: true });
    }
    catch (err) {
        console.error('Clear queue error:', err);
        res.status(500).json({ error: 'Failed to clear queue' });
    }
});
// POST /api/queue/sent/clear — 清除已發文記錄（POSTED → ARCHIVED）
router.post('/sent/clear', async (req, res) => {
    try {
        const { workspace_id } = req.body;
        if (!workspace_id)
            return res.status(400).json({ error: 'workspace_id required' });
        const result = await (0, client_1.query)(`UPDATE posts SET status = 'ARCHIVED' WHERE workspace_id = $1 AND status = 'POSTED'`, [workspace_id]);
        res.json({ cleared: result.rowCount ?? 0, success: true });
    }
    catch (err) {
        console.error('Clear sent error:', err);
        res.status(500).json({ error: 'Failed to clear sent posts' });
    }
});
// GET /api/queue/followed — 已追蹤的帳號（最近 50 筆）
router.get('/followed', async (req, res) => {
    try {
        const { workspace_id } = req.query;
        if (!workspace_id)
            return res.status(400).json({ error: 'workspace_id required' });
        const result = await (0, client_1.query)(`SELECT i.id, i.post_id, i.executed_at, p.author_handle, p.post_url, p.post_text
       FROM interactions i
       LEFT JOIN posts p ON p.id = i.post_id
       WHERE i.workspace_id = $1 AND i.action = 'follow'
       ORDER BY i.executed_at DESC NULLS LAST
       LIMIT 50`, [workspace_id]);
        res.json({ followed: result.rows, count: result.rows.length, success: true });
    }
    catch (err) {
        console.error('Followed fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch followed' });
    }
});
// GET /api/queue/sent — 已發出的貼文（最近 50 筆）
router.get('/sent', async (req, res) => {
    try {
        const { workspace_id } = req.query;
        if (!workspace_id)
            return res.status(400).json({ error: 'workspace_id required' });
        const result = await (0, client_1.query)(`SELECT p.*, json_agg(d.* ORDER BY d.created_at DESC) FILTER (WHERE d.id IS NOT NULL AND d.approved = true) as drafts
       FROM posts p
       LEFT JOIN drafts d ON d.post_id = p.id
       WHERE p.workspace_id = $1 AND p.status = 'POSTED'
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT 50`, [workspace_id]);
        const sent = result.rows.map(row => ({
            ...transformPost(row),
            drafts: Array.isArray(row.drafts) ? row.drafts.map(transformDraft) : [],
        }));
        res.json({ sent, count: sent.length, success: true });
    }
    catch (err) {
        console.error('Sent posts fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch sent posts' });
    }
});
// POST /api/queue/skip/:postId
router.post('/skip/:postId', async (req, res) => {
    try {
        const result = await (0, client_1.query)("UPDATE posts SET status = 'SKIPPED' WHERE id = $1 RETURNING *", [req.params.postId]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Post not found' });
        res.json({ post: transformPost(result.rows[0]), success: true });
    }
    catch (err) {
        console.error('Skip post error:', err);
        res.status(500).json({ error: 'Failed to skip post' });
    }
});
exports.default = router;
