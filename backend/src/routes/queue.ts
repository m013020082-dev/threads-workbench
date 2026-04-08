import { Router, Request, Response } from 'express';
import { query } from '../db/client';

const router = Router();

function transformPost(row: any) {
  return {
    ...row,
    reply_count: row.comment_count || 0,
    repost_count: row.repost_count || 0,
    engagement_count: (row.like_count || 0) + (row.comment_count || 0),
    posted_at: row.created_at,
    score: row.score || 0,
  };
}

function transformDraft(row: any) {
  return {
    ...row,
    draft_text: row.text || row.draft_text || '',
    // Bug #5：統一使用 ';' 分隔符，與 drafts.ts 及 draftService 一致
    risk_warnings: Array.isArray(row.risk_warnings)
      ? row.risk_warnings
      : (row.risk_warnings || row.risk_notes || '').split(';').map((s: string) => s.trim()).filter(Boolean),
  };
}

// GET /api/queue?workspace_id=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });

    const result = await query(
      `SELECT p.*, json_agg(d.* ORDER BY d.created_at DESC) FILTER (WHERE d.id IS NOT NULL) as drafts
       FROM posts p
       LEFT JOIN drafts d ON d.post_id = p.id
       WHERE p.workspace_id = $1 AND p.status IN ('DRAFTED','APPROVED','READY_FOR_REVIEW')
       GROUP BY p.id
       ORDER BY p.score DESC`,
      [workspace_id]
    );

    const queue = result.rows.map(row => ({
      ...transformPost(row),
      drafts: Array.isArray(row.drafts) ? row.drafts.map(transformDraft) : [],
    }));

    res.json({ queue, count: queue.length, success: true });
  } catch (err) {
    console.error('Queue fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// POST /api/queue/add
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { post_id } = req.body;
    if (!post_id) return res.status(400).json({ error: 'post_id required' });

    const result = await query(
      "UPDATE posts SET status = 'READY_FOR_REVIEW' WHERE id = $1 RETURNING *",
      [post_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    res.json({ post: transformPost(result.rows[0]), success: true });
  } catch (err) {
    console.error('Add to queue error:', err);
    res.status(500).json({ error: 'Failed to add to queue' });
  }
});

// POST /api/queue/approve-all — 批次核准所有有草稿的貼文（選最佳草稿）
router.post('/approve-all', async (req: Request, res: Response) => {
  try {
    const { workspace_id } = req.body;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });

    // 取得所有 DRAFTED / READY_FOR_REVIEW 且有草稿的貼文
    const postsRes = await query(
      `SELECT p.id as post_id, d.id as draft_id, d.similarity_score,
              array_length(d.risk_warnings, 1) as warning_count
       FROM posts p
       JOIN drafts d ON d.post_id = p.id AND d.approved = false
       WHERE p.workspace_id = $1 AND p.status IN ('DRAFTED','READY_FOR_REVIEW')
       ORDER BY p.id, COALESCE(array_length(d.risk_warnings, 1), 0) ASC, d.similarity_score ASC`,
      [workspace_id]
    );

    // 每篇貼文選第一筆（最少警告、最低相似度）
    const seen = new Set<string>();
    const toApprove: { postId: string; draftId: string }[] = [];
    for (const row of postsRes.rows) {
      if (!seen.has(row.post_id)) {
        seen.add(row.post_id);
        toApprove.push({ postId: row.post_id, draftId: row.draft_id });
      }
    }

    let approved = 0;
    for (const { postId, draftId } of toApprove) {
      await query('UPDATE drafts SET approved = true WHERE id = $1', [draftId]);
      await query("UPDATE posts SET status = 'APPROVED' WHERE id = $1", [postId]);
      approved++;
    }

    res.json({ approved, success: true });
  } catch (err) {
    console.error('Approve-all error:', err);
    res.status(500).json({ error: 'Failed to approve all' });
  }
});

// POST /api/queue/batch-follow — 批次標記為建議追蹤
router.post('/batch-follow', async (req: Request, res: Response) => {
  try {
    const { post_ids } = req.body;
    if (!Array.isArray(post_ids) || post_ids.length === 0) {
      return res.status(400).json({ error: 'post_ids array required' });
    }

    const placeholders = post_ids.map((_, i) => `$${i + 1}`).join(',');
    await query(
      `UPDATE posts SET status = 'FOLLOW_SUGGESTED' WHERE id IN (${placeholders})`,
      post_ids
    );

    res.json({ updated: post_ids.length, success: true });
  } catch (err) {
    console.error('Batch-follow error:', err);
    res.status(500).json({ error: 'Failed to batch follow' });
  }
});

// POST /api/queue/skip/:postId
router.post('/skip/:postId', async (req: Request, res: Response) => {
  try {
    const result = await query(
      "UPDATE posts SET status = 'SKIPPED' WHERE id = $1 RETURNING *",
      [req.params.postId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    res.json({ post: transformPost(result.rows[0]), success: true });
  } catch (err) {
    console.error('Skip post error:', err);
    res.status(500).json({ error: 'Failed to skip post' });
  }
});

export default router;
