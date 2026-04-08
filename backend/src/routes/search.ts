import { Router, Request, Response } from 'express';
import { searchPosts } from '../services/searchService';
import { rankPosts } from '../services/rankingService';
import { query } from '../db/client';

const router = Router();

// Transform DB post row to match frontend Post interface
function transformPost(row: any) {
  return {
    ...row,
    reply_count: row.comment_count || 0,
    repost_count: row.repost_count || 0,
    engagement_count: (row.like_count || 0) + (row.comment_count || 0),
    posted_at: row.created_at,
    score: row.score || 0,
    status: row.status || 'DISCOVERED',
    region: row.region || 'TW',
    author_location: row.author_location || '',
  };
}

// POST /api/search
router.post('/search', async (req: Request, res: Response) => {
  try {
    const {
      workspace_id,
      keywords,
      time_range,
      engagement_threshold,
      min_followers,
      max_followers,
      search_mode,
    } = req.body;

    // Bug #8：驗證 time_range 為合法值
    const validRanges = ['1h', '6h', '24h', '7d'];
    const safeTimeRange = validRanges.includes(time_range) ? time_range : '24h';

    const { posts, expandedKeywords } = await searchPosts({
      workspace_id,
      keywords: keywords || [],
      time_range: safeTimeRange,
      engagement_threshold: engagement_threshold || 0,
      follower_min: min_followers || 0,
      follower_max: max_followers || 0,
      region: 'TW',
      search_mode: search_mode || 'fuzzy',
    });

    const searchKws: string[] = keywords || [];
    const isFuzzy = (search_mode || 'fuzzy') !== 'precise';
    // 模糊模式：用擴展詞評分（讓相關貼文分數更高），不過濾
    // 精準模式：只保留含原始關鍵字的貼文
    const scoringKws = isFuzzy ? expandedKeywords : searchKws;
    const filterStrict = !isFuzzy && searchKws.length > 0;
    const ranked = await rankPosts(posts, workspace_id, scoringKws, filterStrict);

    for (const r of ranked) {
      await query(
        "UPDATE posts SET score = $1, status = 'SCORED' WHERE id = $2",
        [r.score, r.post.id]
      );
    }

    const results = ranked.map(r => ({
      ...r,
      post: transformPost(r.post),
    }));

    res.json({ results, total: results.length, success: true });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed', detail: String(err) });
  }
});

// POST /api/score — re-score existing discovered posts
router.post('/score', async (req: Request, res: Response) => {
  try {
    const { workspace_id } = req.body;
    const postsRes = await query(
      "SELECT * FROM posts WHERE workspace_id = $1 AND status = 'DISCOVERED'",
      [workspace_id]
    );
    const ranked = await rankPosts(postsRes.rows, workspace_id);

    for (const r of ranked) {
      await query(
        "UPDATE posts SET score = $1, status = 'SCORED' WHERE id = $2",
        [r.score, r.post.id]
      );
    }

    const results = ranked.map(r => ({
      ...r,
      post: transformPost(r.post),
    }));

    res.json({ results, total: results.length, success: true });
  } catch (err) {
    console.error('Score error:', err);
    res.status(500).json({ error: 'Scoring failed' });
  }
});

// PATCH /api/posts/:id — update post_text
router.patch('/posts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { post_text } = req.body;
    if (!post_text || typeof post_text !== 'string') {
      return res.status(400).json({ error: 'post_text required' });
    }
    const result = await query(
      'UPDATE posts SET post_text = $1 WHERE id = $2 RETURNING *',
      [post_text.trim(), id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: transformPost(result.rows[0]), success: true });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
