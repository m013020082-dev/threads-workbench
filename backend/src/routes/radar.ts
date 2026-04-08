import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import { startRadarExecution, confirmExecution, cancelExecution, getActiveSession } from '../services/executeService';

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
      `INSERT INTO interactions (id, post_id, draft_id, workspace_id, action_type, action_time)
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

export default router;
