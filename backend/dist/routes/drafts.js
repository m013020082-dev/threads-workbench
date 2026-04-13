"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const draftService_1 = require("../services/draftService");
const client_1 = require("../db/client");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// Transform DB draft row to match frontend Draft interface
function transformDraft(row) {
    return {
        ...row,
        draft_text: row.draft_text || '',
        risk_warnings: Array.isArray(row.risk_warnings)
            ? row.risk_warnings
            : (row.risk_warnings || row.risk_notes || '').split(';').map((s) => s.trim()).filter(Boolean),
    };
}
// POST /api/generate-drafts
router.post('/generate-drafts', async (req, res) => {
    try {
        const { post_id, post_text, style, brand_voice, length, emoji_enabled, workspace_id, posting_logic, reply_note } = req.body;
        if (!post_id)
            return res.status(400).json({ error: 'post_id is required' });
        // Fetch post if post_text not provided
        let text = post_text;
        if (!text) {
            const postRes = await (0, client_1.query)('SELECT * FROM posts WHERE id = $1', [post_id]);
            if (postRes.rows.length === 0)
                return res.status(404).json({ error: 'Post not found' });
            text = postRes.rows[0].post_text;
        }
        const draftResults = await (0, draftService_1.generateDrafts)({
            post_id,
            post_text: text,
            style: style || 'professional',
            brand_voice: brand_voice || '',
            length: length || 'medium',
            emoji_enabled: !!emoji_enabled,
            posting_logic: posting_logic || '擬人幽默',
            reply_note: reply_note || '',
        });
        const saved = [];
        for (const d of draftResults) {
            const id = (0, uuid_1.v4)();
            const r = await (0, client_1.query)('INSERT INTO drafts (id, post_id, workspace_id, draft_text, text, style, similarity_score, risk_warnings) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [id, post_id, workspace_id || null, d.text, d.text || '', d.style, d.similarity_score,
                d.risk_notes ? d.risk_notes.split(';').map((s) => s.trim()).filter(Boolean) : []]);
            saved.push(transformDraft(r.rows[0]));
        }
        await (0, client_1.query)("UPDATE posts SET status = 'DRAFTED' WHERE id = $1", [post_id]);
        res.json({ drafts: saved, count: saved.length, success: true });
    }
    catch (err) {
        console.error('Generate drafts error:', err);
        res.status(500).json({ error: 'Draft generation failed' });
    }
});
// GET /api/drafts/:postId
router.get('/drafts/:postId', async (req, res) => {
    try {
        const result = await (0, client_1.query)('SELECT * FROM drafts WHERE post_id = $1 ORDER BY created_at DESC', [req.params.postId]);
        res.json({ drafts: result.rows.map(transformDraft), success: true });
    }
    catch (err) {
        console.error('Get drafts error:', err);
        res.status(500).json({ error: 'Failed to fetch drafts' });
    }
});
// POST /api/approve-draft
router.post('/approve-draft', async (req, res) => {
    try {
        const { draft_id } = req.body;
        if (!draft_id)
            return res.status(400).json({ error: 'draft_id is required' });
        const result = await (0, client_1.query)('UPDATE drafts SET approved = true WHERE id = $1 RETURNING *', [draft_id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Draft not found' });
        await (0, client_1.query)("UPDATE posts SET status = 'APPROVED' WHERE id = $1", [result.rows[0].post_id]);
        res.json({ draft: transformDraft(result.rows[0]), success: true });
    }
    catch (err) {
        console.error('Approve draft error:', err);
        res.status(500).json({ error: 'Failed to approve draft' });
    }
});
// DELETE /api/drafts/:draftId
router.delete('/drafts/:draftId', async (req, res) => {
    try {
        await (0, client_1.query)('DELETE FROM drafts WHERE id = $1', [req.params.draftId]);
        res.json({ success: true });
    }
    catch (err) {
        console.error('Delete draft error:', err);
        res.status(500).json({ error: 'Failed to delete draft' });
    }
});
exports.default = router;
