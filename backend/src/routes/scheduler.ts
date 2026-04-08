import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import { createJob } from '../services/schedulerService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/scheduler/create
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { workspace_id, name, job_type, cron_expression, config } = req.body;

    const allowed = ['search', 'score', 'draft'];
    if (!allowed.includes(job_type)) {
      return res.status(400).json({ error: 'job_type must be: search, score, or draft' });
    }
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!cron_expression) return res.status(400).json({ error: 'cron_expression is required' });
    // Bug #19：驗證 config 物件
    if (config !== undefined && config !== null) {
      if (config.max_posts !== undefined && (typeof config.max_posts !== 'number' || config.max_posts < 1)) {
        return res.status(400).json({ error: 'config.max_posts 必須為大於 0 的整數' });
      }
      if (config.max_drafts !== undefined && (typeof config.max_drafts !== 'number' || config.max_drafts < 1)) {
        return res.status(400).json({ error: 'config.max_drafts 必須為大於 0 的整數' });
      }
    }

    const id = uuidv4();
    const result = await query(
      'INSERT INTO scheduled_jobs (id, workspace_id, name, job_type, cron_expression, config) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [id, workspace_id, name, job_type, cron_expression, config ? JSON.stringify(config) : null]
    );

    res.json({ job: result.rows[0], success: true });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ error: 'Failed to create scheduled job' });
  }
});

// GET /api/scheduler/list?workspace_id=...
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { workspace_id } = req.query;
    const whereClause = workspace_id ? 'WHERE j.workspace_id = $1' : '';
    const params = workspace_id ? [workspace_id] : [];

    const result = await query(
      `SELECT j.*, r.started_at as last_run_at, r.status as last_status
       FROM scheduled_jobs j
       LEFT JOIN LATERAL (
         SELECT * FROM scheduled_job_runs WHERE job_id = j.id ORDER BY started_at DESC LIMIT 1
       ) r ON true
       ${whereClause}
       ORDER BY j.created_at DESC`,
      params
    );

    res.json({ jobs: result.rows, success: true });
  } catch (err) {
    console.error('List jobs error:', err);
    res.status(500).json({ error: 'Failed to list scheduled jobs' });
  }
});

// POST /api/scheduler/toggle/:jobId
router.post('/toggle/:jobId', async (req: Request, res: Response) => {
  try {
    const current = await query('SELECT * FROM scheduled_jobs WHERE id = $1', [req.params.jobId]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

    const newEnabled = req.body.enabled !== undefined ? !!req.body.enabled : !current.rows[0].enabled;
    const result = await query(
      'UPDATE scheduled_jobs SET enabled = $1 WHERE id = $2 RETURNING *',
      [newEnabled, req.params.jobId]
    );

    if (newEnabled) {
      try { await createJob(result.rows[0]); } catch (_) {}
    }

    res.json({ job: result.rows[0], success: true });
  } catch (err) {
    console.error('Toggle job error:', err);
    res.status(500).json({ error: 'Failed to toggle job' });
  }
});

export default router;
