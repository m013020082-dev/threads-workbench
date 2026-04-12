"use strict";
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
const express_1 = require("express");
const client_1 = require("../db/client");
const executeService_1 = require("../services/executeService");
const cookiePublisher_1 = require("../services/cookiePublisher");
const threadsApiService_1 = require("../services/threadsApiService");
const router = (0, express_1.Router)();
// POST /api/radar/execute/start
router.post('/execute/start', async (req, res) => {
    try {
        const { post_id, draft_id, action_type, author_handle } = req.body;
        if (!post_id || !action_type || !author_handle) {
            return res.status(400).json({ error: 'post_id, action_type, author_handle required' });
        }
        const postRes = await (0, client_1.query)('SELECT post_url FROM posts WHERE id = $1', [post_id]);
        if (postRes.rows.length === 0)
            return res.status(404).json({ error: 'Post not found' });
        let draftText = req.body.draft_text || '';
        if (draft_id) {
            const draftRes = await (0, client_1.query)('SELECT draft_text FROM drafts WHERE id = $1', [draft_id]);
            if (draftRes.rows.length > 0)
                draftText = draftRes.rows[0].draft_text;
        }
        const session = await (0, executeService_1.startRadarExecution)(post_id, draft_id || null, postRes.rows[0].post_url, draftText, action_type, author_handle);
        res.json({ session, success: true });
    }
    catch (err) {
        console.error('Radar execute start error:', err);
        res.status(500).json({ error: 'Failed to start radar execution' });
    }
});
// POST /api/radar/execute/confirm
router.post('/execute/confirm', async (req, res) => {
    try {
        const session = (0, executeService_1.getActiveSession)();
        const actionType = session?.actionType || 'comment';
        const { postId, draftId } = await (0, executeService_1.confirmExecution)();
        // 更新貼文狀態
        await (0, client_1.query)("UPDATE posts SET status = 'POSTED' WHERE id = $1", [postId]);
        // 記錄互動
        const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require('uuid')));
        const workspaceRes = await (0, client_1.query)('SELECT workspace_id FROM posts WHERE id = $1', [postId]);
        const workspaceId = workspaceRes.rows[0]?.workspace_id;
        await (0, client_1.query)(`INSERT INTO interactions (id, post_id, draft_id, workspace_id, action, executed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`, [uuidv4(), postId, draftId, workspaceId, actionType]);
        res.json({ success: true, post_id: postId, action_type: actionType, status: 'POSTED' });
    }
    catch (err) {
        console.error('Radar execute confirm error:', err);
        res.status(500).json({ error: 'Failed to confirm radar execution' });
    }
});
// POST /api/radar/execute/cancel
router.post('/execute/cancel', async (_req, res) => {
    try {
        await (0, executeService_1.cancelExecution)();
        res.json({ success: true });
    }
    catch (err) {
        console.error('Radar execute cancel error:', err);
        res.status(500).json({ error: 'Failed to cancel' });
    }
});
// GET /api/radar/execute/status
router.get('/execute/status', (_req, res) => {
    res.json({ session: (0, executeService_1.getActiveSession)(), success: true });
});
// POST /api/radar/execute-direct — headless 全自動執行，不開瀏覽器視窗
// action_type: 'follow' | 'comment' | 'both'
router.post('/execute-direct', async (req, res) => {
    try {
        const { post_id, action_type, author_handle, draft_text } = req.body;
        if (!post_id || !action_type || !author_handle) {
            return res.status(400).json({ error: 'post_id, action_type, author_handle required' });
        }
        const postRes = await (0, client_1.query)('SELECT post_url, workspace_id FROM posts WHERE id = $1', [post_id]);
        if (postRes.rows.length === 0)
            return res.status(404).json({ error: 'Post not found' });
        const { post_url, workspace_id } = postRes.rows[0];
        const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require('uuid')));
        let commentResult = { success: true };
        let followResult = { success: true };
        // 留言
        if (action_type === 'comment' || action_type === 'both') {
            if (!draft_text) {
                return res.status(400).json({ error: 'draft_text required for comment/both' });
            }
            commentResult = await (0, threadsApiService_1.replyViaApi)(post_url, draft_text);
            if (!commentResult.success) {
                console.log(`[Radar] Threads API 失敗，退回 Cookie headless`);
                commentResult = await (0, cookiePublisher_1.replyWithCookies)(post_url, draft_text);
            }
        }
        // 追蹤
        if (action_type === 'follow' || action_type === 'both') {
            followResult = await (0, cookiePublisher_1.followWithCookies)(author_handle);
        }
        const success = commentResult.success && followResult.success;
        const error = !commentResult.success
            ? commentResult.error
            : !followResult.success ? followResult.error : undefined;
        if (success) {
            await (0, client_1.query)("UPDATE posts SET status = 'POSTED' WHERE id = $1", [post_id]);
            await (0, client_1.query)(`INSERT INTO interactions (id, post_id, draft_id, workspace_id, action, executed_at)
         VALUES ($1, $2, NULL, $3, $4, NOW())`, [uuidv4(), post_id, workspace_id, action_type]);
        }
        res.json({ success, error, post_id, action_type });
    }
    catch (err) {
        console.error('Radar execute-direct error:', err);
        res.status(500).json({ error: 'Failed to execute' });
    }
});
exports.default = router;
