import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';

const router = Router();

// 所有工作區路由都需要 Google 登入
router.use(requireAuth);

// POST /api/workspace/create
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { name, brand_voice, keywords } = req.body;
    const userId = req.user!.id;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const id = uuidv4();
    const result = await query(
      'INSERT INTO workspaces (id, name, brand_voice, user_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, name, brand_voice || '', userId]
    );
    const workspace = result.rows[0];

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

// GET /api/workspace/list — 只回傳該用戶的工作區
router.get('/list', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userEmail = (req.user as any).email || '';
    const userName = (req.user as any).name || userEmail || '用戶';

    // 確保 users 表有此用戶（JWT 可能比 users 表更早建立）
    await query(
      `INSERT INTO users (id, google_id, email, name, picture)
       VALUES ($1, $2, $3, $4, '')
       ON CONFLICT (id) DO NOTHING`,
      [userId, userId, userEmail, userName]
    ).catch(() => {
      // 若 users 表不存在或有其他 conflict 就忽略，workspace 會用 NULL user_id
    });

    let result = await query(
      'SELECT * FROM workspaces WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );

    // 若該用戶沒有工作區，自動建立預設工作區
    if (result.rows.length === 0) {
      const id = uuidv4();
      try {
        await query(
          'INSERT INTO workspaces (id, name, brand_voice, user_id) VALUES ($1,$2,$3,$4)',
          [id, userName, '', userId]
        );
      } catch (insertErr: any) {
        // FK 違反時（userId 不在 users 表）改用 NULL user_id
        console.warn('List: workspace insert failed, retrying with NULL user_id:', insertErr.message);
        await query(
          'INSERT INTO workspaces (id, name, brand_voice) VALUES ($1,$2,$3)',
          [id, userName, '']
        );
        // 補上 user_id（若欄位允許）
        await query(
          'UPDATE workspaces SET user_id = $1 WHERE id = $2',
          [userId, id]
        ).catch(() => {});
      }
      result = await query(
        'SELECT * FROM workspaces WHERE user_id = $1 ORDER BY created_at ASC',
        [userId]
      );
      // 若還是空的（FK 仍然失敗），改用 id 查詢
      if (result.rows.length === 0) {
        result = await query('SELECT * FROM workspaces WHERE id = $1', [id]);
      }
    }

    res.json({ workspaces: result.rows, success: true });
  } catch (err) {
    console.error('List workspaces error:', err);
    res.status(500).json({ error: 'Failed to list workspaces' });
  }
});

// POST /api/workspace/switch — 只能切換自己的工作區
router.post('/switch', async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    const userId = req.user!.id;
    if (!id) return res.status(400).json({ error: 'id is required' });

    // 允許 user_id 匹配或 user_id 為 NULL（相容舊資料）
    const wsRes = await query(
      'SELECT * FROM workspaces WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
      [id, userId]
    );
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

    res.json({
      workspace: wsRes.rows[0],
      keywords: kwRes.rows,
      stats: statsRes.rows[0] || { total_posts: '0', posts_in_queue: '0', approved_drafts: '0' },
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
    res.status(500).json({ error: 'Failed to delete keyword' });
  }
});

export default router;
