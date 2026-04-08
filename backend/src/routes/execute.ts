import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import {
  startExecution,
  confirmExecution,
  cancelExecution,
  getActiveSession,
} from '../services/executeService';
import { replyViaApi } from '../services/threadsApiService';
import { replyWithCookies } from '../services/cookiePublisher';

const router = Router();

// GET /api/execute/status
router.get('/status', (_req: Request, res: Response) => {
  const session = getActiveSession();
  res.json({ session, success: true });
});

// POST /api/execute/start — 開啟瀏覽器、填入草稿、等待確認
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { post_id, draft_id } = req.body;
    if (!post_id || !draft_id) return res.status(400).json({ error: 'post_id and draft_id required' });

    // 取得貼文 URL
    const postRes = await query('SELECT post_url FROM posts WHERE id = $1', [post_id]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    // 取得草稿內容
    const draftRes = await query('SELECT draft_text FROM drafts WHERE id = $1', [draft_id]);
    if (draftRes.rows.length === 0) return res.status(404).json({ error: 'Draft not found' });

    const postUrl = postRes.rows[0].post_url;
    const draftText = draftRes.rows[0].draft_text;

    // 非同步啟動（不等待完成，立即回傳初始狀態）
    const session = await startExecution(post_id, draft_id, postUrl, draftText);

    res.json({ session, success: true });
  } catch (err) {
    console.error('Execute start error:', err);
    res.status(500).json({ error: 'Failed to start execution' });
  }
});

// POST /api/execute/confirm — 使用者確認已手動送出
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { postId, draftId } = await confirmExecution();

    // 更新貼文狀態為 POSTED
    await query("UPDATE posts SET status = 'POSTED' WHERE id = $1", [postId]);

    // 記錄互動（interactions 表）
    const { v4: uuidv4 } = await import('uuid');
    const workspaceRes = await query('SELECT workspace_id FROM posts WHERE id = $1', [postId]);
    const workspaceId = workspaceRes.rows[0]?.workspace_id;

    await query(
      `INSERT INTO interactions (id, post_id, draft_id, workspace_id, action_type, action_time)
       VALUES ($1, $2, $3, $4, 'comment', NOW())`,
      [uuidv4(), postId, draftId, workspaceId]
    );

    res.json({ success: true, post_id: postId, status: 'POSTED' });
  } catch (err) {
    console.error('Execute confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm execution' });
  }
});

// POST /api/execute/reply-direct — headless 直接送出回覆，不開視窗
router.post('/reply-direct', async (req: Request, res: Response) => {
  try {
    const { post_id, draft_id } = req.body;
    if (!post_id || !draft_id) return res.status(400).json({ error: 'post_id and draft_id required' });

    const postRes = await query('SELECT post_url, workspace_id FROM posts WHERE id = $1', [post_id]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    const draftRes = await query('SELECT draft_text FROM drafts WHERE id = $1', [draft_id]);
    if (draftRes.rows.length === 0) return res.status(404).json({ error: 'Draft not found' });

    const { post_url, workspace_id } = postRes.rows[0];
    const { draft_text } = draftRes.rows[0];

    // 官方 Graph API 無法查詢其他用戶的貼文 ID，回覆只能用 Cookie/Playwright
    const result = await replyWithCookies(post_url, draft_text);
    console.log(`[Execute] 回覆模式: Cookie/Playwright → ${result.success ? '成功' : result.error}`);

    if (result.success) {
      await query("UPDATE posts SET status = 'POSTED' WHERE id = $1", [post_id]);
      const { v4: uuidv4 } = await import('uuid');
      await query(
        `INSERT INTO interactions (id, post_id, draft_id, workspace_id, action, executed_at)
         VALUES ($1, $2, $3, $4, 'comment', NOW())`,
        [uuidv4(), post_id, draft_id, workspace_id]
      );
    }

    res.json({ ...result, post_id });
  } catch (err) {
    console.error('Reply direct error:', err);
    res.status(500).json({ error: 'Failed to reply' });
  }
});

// POST /api/execute/cancel — 取消執行
router.post('/cancel', async (_req: Request, res: Response) => {
  try {
    await cancelExecution();
    res.json({ success: true });
  } catch (err) {
    console.error('Execute cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel execution' });
  }
});

export default router;
