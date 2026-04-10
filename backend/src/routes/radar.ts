import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import { startRadarExecution, confirmExecution, cancelExecution, getActiveSession } from '../services/executeService';
import { replyWithCookies, followWithCookies } from '../services/cookiePublisher';
import { replyViaApi } from '../services/threadsApiService';

const router = Router();

// POST /api/radar/execute/start
router.post('/execute/start', async (req: Request, res: Response) => {
  try {
    const { post_id, draft_id, action_type, author_handle } = req.body;
    if (!post_id || !action_type || !author_handle) {
      return res.status(400).json({ error: 'post_id, action_type, author_handle required' });
    }

    const postRes = await query('SELECT post_url FROM posts WHERE id = $1', [post_id]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    let draftText = req.body.draft_text || '';
    if (draft_id) {
      const draftRes = await query('SELECT draft_text FROM drafts WHERE id = $1', [draft_id]);
      if (draftRes.rows.length > 0) draftText = draftRes.rows[0].draft_text;
    }

    const session = await startRadarExecution(
      post_id,
      draft_id || null,
      postRes.rows[0].post_url,
      draftText,
      action_type,
      author_handle
    );

    res.json({ session, success: true });
  } catch (err) {
    console.error('Radar execute start error:', err);
    res.status(500).json({ error: 'Failed to start radar execution' });
  }
});

// POST /api/radar/execute/confirm
router.post('/execute/confirm', async (req: Request, res: Response) => {
  try {
    const session = getActiveSession();
    const actionType = session?.actionType || 'comment';
    const { postId, draftId } = await confirmExecution();

    // 更新貼文狀態
    await query("UPDATE posts SET status = 'POSTED' WHERE id = $1", [postId]);

    // 記錄互動
    const { v4: uuidv4 } = await import('uuid');
    const workspaceRes = await query('SELECT workspace_id FROM posts WHERE id = $1', [postId]);
    const workspaceId = workspaceRes.rows[0]?.workspace_id;

    await query(
      `INSERT INTO interactions (id, post_id, draft_id, workspace_id, action, executed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), postId, draftId, workspaceId, actionType]
    );

    res.json({ success: true, post_id: postId, action_type: actionType, status: 'POSTED' });
  } catch (err) {
    console.error('Radar execute confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm radar execution' });
  }
});

// POST /api/radar/execute/cancel
router.post('/execute/cancel', async (_req: Request, res: Response) => {
  try {
    await cancelExecution();
    res.json({ success: true });
  } catch (err) {
    console.error('Radar execute cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

// GET /api/radar/execute/status
router.get('/execute/status', (_req: Request, res: Response) => {
  res.json({ session: getActiveSession(), success: true });
});

// POST /api/radar/execute-direct — headless 全自動執行，不開瀏覽器視窗
// action_type: 'follow' | 'comment' | 'both'
router.post('/execute-direct', async (req: Request, res: Response) => {
  try {
    const { post_id, action_type, author_handle, draft_text } = req.body;
    if (!post_id || !action_type || !author_handle) {
      return res.status(400).json({ error: 'post_id, action_type, author_handle required' });
    }

    const postRes = await query('SELECT post_url, workspace_id FROM posts WHERE id = $1', [post_id]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    const { post_url, workspace_id } = postRes.rows[0];
    const { v4: uuidv4 } = await import('uuid');

    let commentResult = { success: true };
    let followResult = { success: true };

    // 留言
    if (action_type === 'comment' || action_type === 'both') {
      if (!draft_text) {
        return res.status(400).json({ error: 'draft_text required for comment/both' });
      }
      commentResult = await replyViaApi(post_url, draft_text);
      if (!commentResult.success) {
        console.log(`[Radar] Threads API 失敗，退回 Cookie headless`);
        commentResult = await replyWithCookies(post_url, draft_text);
      }
    }

    // 追蹤
    if (action_type === 'follow' || action_type === 'both') {
      followResult = await followWithCookies(author_handle);
    }

    const success = commentResult.success && followResult.success;
    const error = !commentResult.success
      ? (commentResult as any).error
      : !followResult.success ? (followResult as any).error : undefined;

    if (success) {
      await query("UPDATE posts SET status = 'POSTED' WHERE id = $1", [post_id]);
      await query(
        `INSERT INTO interactions (id, post_id, draft_id, workspace_id, action, executed_at)
         VALUES ($1, $2, NULL, $3, $4, NOW())`,
        [uuidv4(), post_id, workspace_id, action_type]
      );
    }

    res.json({ success, error, post_id, action_type });
  } catch (err) {
    console.error('Radar execute-direct error:', err);
    res.status(500).json({ error: 'Failed to execute' });
  }
});


export default router;
