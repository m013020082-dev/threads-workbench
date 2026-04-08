import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/workspace/create
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { name, brand_voice, default_comment_style, keywords } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const id = uuidv4();
    const result = await query(
      'INSERT INTO workspaces (id, name, brand_voice) VALUES ($1,$2,$3) RETURNING *',
      [id, name, brand_voice || '']
    );
    const workspace = result.rows[0];

    // Optionally seed keywords
    if (Array.isArray(keywords) && keywords.length > 0) {
      for (const kw of keywords) {
        if (typeof kw === 'string' && kw.trim()) {
          await query(
            'INSERT INTO keywords (id, workspace_id, keyword) VALUES ($1,$2,$3)',
            [uuidv4(), id, kw.trim()]
          );
        }
      }
    }

    res.json({ workspace, success: true });
  } catch (err) {
    console.error('Create workspace error:', err);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// GET /api/workspace/list
router.get('/list', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM workspaces ORDER BY created_at ASC');
    res.json({ workspaces: result.rows, success: true });
  } catch (err) {
    console.error('List workspaces error:', err);
    res.status(500).json({ error: 'Failed to list workspaces' });
  }
});

// POST /api/workspace/switch
router.post('/switch', async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const wsRes = await query('SELECT * FROM workspaces WHERE id = $1', [id]);
    if (wsRes.rows.length === 0) return res.status(404).json({ error: 'Workspace not found' });

    const kwRes = await query(
      'SELECT id, keyword, enabled as weight FROM keywords WHERE workspace_id = $1',
      [id]
    );

    const statsRes = await query(
      `SELECT
        COUNT(*) FILTER (WHERE workspace_id = $1) as total_posts,
        COUNT(*) FILTER (WHERE workspace_id = $1 AND status IN ('DRAFTED','APPROVED','READY_FOR_REVIEW')) as posts_in_queue,
        COUNT(*) FILTER (WHERE workspace_id = $1 AND status = 'APPROVED') as approved_drafts
       FROM posts WHERE workspace_id = $1`,
      [id]
    );

    const stats = statsRes.rows[0] || { total_posts: '0', posts_in_queue: '0', approved_drafts: '0' };

    res.json({
      workspace: wsRes.rows[0],
      keywords: kwRes.rows,
      stats,
      success: true,
    });
  } catch (err) {
    console.error('Switch workspace error:', err);
    res.status(500).json({ error: 'Failed to switch workspace' });
  }
});

// GET /api/workspace/:id/keywords
router.get('/:id/keywords', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM keywords WHERE workspace_id = $1',
      [req.params.id]
    );
    res.json({ keywords: result.rows, success: true });
  } catch (err) {
    console.error('Get keywords error:', err);
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// POST /api/workspace/:id/keywords
router.post('/:id/keywords', async (req: Request, res: Response) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'keyword is required' });

    const id = uuidv4();
    const result = await query(
      'INSERT INTO keywords (id, workspace_id, keyword) VALUES ($1,$2,$3) RETURNING *',
      [id, req.params.id, keyword]
    );
    res.json({ keyword: result.rows[0], success: true });
  } catch (err) {
    console.error('Add keyword error:', err);
    res.status(500).json({ error: 'Failed to add keyword' });
  }
});

// DELETE /api/workspace/:id/keywords/:kid
router.delete('/:id/keywords/:kid', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM keywords WHERE id = $1 AND workspace_id = $2', [
      req.params.kid,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete keyword error:', err);
    res.status(500).json({ error: 'Failed to delete keyword' });
  }
});

export default router;
