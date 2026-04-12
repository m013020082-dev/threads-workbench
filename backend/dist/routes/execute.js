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
const antiSpamService_1 = require("../services/antiSpamService");
const router = (0, express_1.Router)();
// GET /api/execute/status
router.get('/status', (_req, res) => {
    const session = (0, executeService_1.getActiveSession)();
    res.json({ session, success: true });
});
// POST /api/execute/start — 開啟瀏覽器、填入草稿、等待確認
router.post('/start', async (req, res) => {
    try {
        const { post_id, draft_id } = req.body;
        if (!post_id || !draft_id)
            return res.status(400).json({ error: 'post_id and draft_id required' });
        // 取得貼文 URL
        const postRes = await (0, client_1.query)('SELECT post_url FROM posts WHERE id = $1', [post_id]);
        if (postRes.rows.length === 0)
            return res.status(404).json({ error: 'Post not found' });
        // 取得草稿內容
        const draftRes = await (0, client_1.query)('SELECT draft_text FROM drafts WHERE id = $1', [draft_id]);
        if (draftRes.rows.length === 0)
            return res.status(404).json({ error: 'Draft not found' });
        const postUrl = postRes.rows[0].post_url;
        const draftText = draftRes.rows[0].draft_text;
        // 非同步啟動（不等待完成，立即回傳初始狀態）
        const session = await (0, executeService_1.startExecution)(post_id, draft_id, postUrl, draftText);
        res.json({ session, success: true });
    }
    catch (err) {
        console.error('Execute start error:', err);
        res.status(500).json({ error: 'Failed to start execution' });
    }
});
// POST /api/execute/confirm — 使用者確認已手動送出
router.post('/confirm', async (req, res) => {
    try {
        const { postId, draftId } = await (0, executeService_1.confirmExecution)();
        // 更新貼文狀態為 POSTED
        await (0, client_1.query)("UPDATE posts SET status = 'POSTED' WHERE id = $1", [postId]);
        // 記錄互動（interactions 表）
        const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require('uuid')));
        const workspaceRes = await (0, client_1.query)('SELECT workspace_id FROM posts WHERE id = $1', [postId]);
        const workspaceId = workspaceRes.rows[0]?.workspace_id;
        await (0, client_1.query)(`INSERT INTO interactions (id, post_id, draft_id, workspace_id, action_type, action_time)
       VALUES ($1, $2, $3, $4, 'comment', NOW())`, [uuidv4(), postId, draftId, workspaceId]);
        res.json({ success: true, post_id: postId, status: 'POSTED' });
    }
    catch (err) {
        console.error('Execute confirm error:', err);
        res.status(500).json({ error: 'Failed to confirm execution' });
    }
});
// POST /api/execute/reply-direct — headless 直接送出回覆，不開視窗
router.post('/reply-direct', async (req, res) => {
    try {
        const { post_id, draft_id } = req.body;
        if (!post_id || !draft_id)
            return res.status(400).json({ error: 'post_id and draft_id required' });
        const postRes = await (0, client_1.query)('SELECT post_url, workspace_id FROM posts WHERE id = $1', [post_id]);
        if (postRes.rows.length === 0)
            return res.status(404).json({ error: 'Post not found' });
        const draftRes = await (0, client_1.query)('SELECT draft_text FROM drafts WHERE id = $1', [draft_id]);
        if (draftRes.rows.length === 0)
            return res.status(404).json({ error: 'Draft not found' });
        const { post_url, workspace_id } = postRes.rows[0];
        // 若前端傳來編輯後的文字，優先使用；否則用 DB 裡的草稿
        let draft_text = req.body.draft_text?.trim() || draftRes.rows[0].draft_text;
        // 自動將簡體字轉換為繁體
        const { hasSimplified, chars } = (0, antiSpamService_1.detectSimplifiedChinese)(draft_text);
        if (hasSimplified) {
            console.warn(`[Execute] 草稿含簡體字: ${chars.join('')}，自動轉換為繁體`);
            draft_text = (0, antiSpamService_1.convertToTraditional)(draft_text);
        }
        // 直接用 Cookie/Playwright（不走官方 API，避免 media_id 攔截失敗問題）
        const result = await (0, cookiePublisher_1.replyWithCookies)(post_url, draft_text);
        console.log(`[Execute] 回覆模式: Cookie/Playwright → ${result.success ? '成功' : result.error}`);
        if (result.success) {
            await (0, client_1.query)("UPDATE posts SET status = 'POSTED' WHERE id = $1", [post_id]);
            const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require('uuid')));
            await (0, client_1.query)(`INSERT INTO interactions (id, post_id, draft_id, workspace_id, action, executed_at)
         VALUES ($1, $2, $3, $4, 'comment', NOW())`, [uuidv4(), post_id, draft_id, workspace_id]);
        }
        res.json({ ...result, post_id });
    }
    catch (err) {
        console.error('Reply direct error:', err);
        res.status(500).json({ error: 'Failed to reply' });
    }
});
// POST /api/execute/cancel — 取消執行
router.post('/cancel', async (_req, res) => {
    try {
        await (0, executeService_1.cancelExecution)();
        res.json({ success: true });
    }
    catch (err) {
        console.error('Execute cancel error:', err);
        res.status(500).json({ error: 'Failed to cancel execution' });
    }
});
exports.default = router;
