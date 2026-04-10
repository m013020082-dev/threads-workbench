import cron from 'node-cron';
import { ScheduledJob } from '../types';
import { query } from '../db/client';
import { searchPosts } from './searchService';
import { rankPosts } from './rankingService';
import { generateDrafts } from './draftService';
import { v4 as uuidv4 } from 'uuid';

const activeTasks = new Map<string, cron.ScheduledTask>();

async function runJob(job: ScheduledJob) {
  const runId = uuidv4();
  await query(
    'INSERT INTO scheduled_job_runs (id, job_id, status) VALUES ($1, $2, $3)',
    [runId, job.id, 'running']
  );

  try {
    const kwRes = await query(
      'SELECT keyword FROM keywords WHERE workspace_id = $1 AND enabled = true',
      [job.workspace_id]
    );
    const keywords = kwRes.rows.map((r: { keyword: string }) => r.keyword);

    let discoveredCount = 0;
    let draftedCount = 0;

    if (job.job_type === 'search' || job.job_type === 'score') {
      const { posts } = await searchPosts({
        workspace_id: job.workspace_id,
        keywords,
        time_range: '24h',
        engagement_threshold: 10,
        follower_min: 100,
        follower_max: 0,
      });

      discoveredCount = posts.length;

      const maxPosts = job.config?.max_posts ?? 20;
      const ranked = await rankPosts(posts, job.workspace_id);
      for (const r of ranked.slice(0, maxPosts)) {
        await query(
          'UPDATE posts SET score = $1, status = $2 WHERE id = $3',
          [r.score, 'SCORED', r.post.id]
        );
      }
    }

    if (job.job_type === 'draft') {
      const maxDrafts = job.config?.max_drafts ?? 5;
      const postsRes = await query(
        `SELECT * FROM posts WHERE workspace_id = $1 AND status = 'SCORED' ORDER BY score DESC LIMIT $2`,
        [job.workspace_id, maxDrafts]
      );
      const wsRes = await query('SELECT * FROM workspaces WHERE id = $1', [job.workspace_id]);
      const ws = wsRes.rows[0];

      // 並行為每篇貼文產生留言草稿
      const draftResults = await Promise.allSettled(
        postsRes.rows.map(async (post) => {
          const drafts = await generateDrafts({
            post_id: post.id,
            post_text: post.post_text,
            style: ws?.default_comment_style || 'professional',
            brand_voice: ws?.brand_voice || '',
            length: 'medium',
            emoji_enabled: false,
          });
          return { post, drafts };
        })
      );

      for (const result of draftResults) {
        if (result.status !== 'fulfilled') continue;
        const { post, drafts } = result.value;
        for (const d of drafts) {
          await query(
            `INSERT INTO drafts (id, post_id, style, text, similarity_score, risk_notes)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [uuidv4(), post.id, d.style, d.text, d.similarity_score, d.risk_notes]
          );
        }
        await query("UPDATE posts SET status = 'DRAFTED' WHERE id = $1", [post.id]);
        draftedCount++;
      }
    }

    await query(
      "UPDATE scheduled_job_runs SET status=$1, finished_at=NOW(), result=$2 WHERE id=$3",
      ['completed', JSON.stringify({ discovered_count: discoveredCount, drafted_count: draftedCount }), runId]
    );
  } catch (err) {
    await query("UPDATE scheduled_job_runs SET status='failed', finished_at=NOW() WHERE id=$1", [runId]);
    console.error('Job failed:', err);
  }
}

export async function createJob(job: ScheduledJob) {
  if (activeTasks.has(job.id)) {
    activeTasks.get(job.id)?.stop();
  }

  if (!job.enabled) return;

  if (!cron.validate(job.cron_expression)) {
    throw new Error(`Invalid cron expression: ${job.cron_expression}`);
  }

  // Bug #9：runJob 是 async，需包 try/catch 避免未捕獲的 rejection 中斷排程
  const task = cron.schedule(job.cron_expression, async () => {
    try {
      await runJob(job);
    } catch (err) {
      console.error(`[Scheduler] Job ${job.id} (${job.name}) 執行失敗:`, err);
    }
  });
  activeTasks.set(job.id, task);
}

export async function startScheduler() {
  const res = await query('SELECT * FROM scheduled_jobs WHERE enabled = true');
  for (const job of res.rows) {
    await createJob(job);
  }
  console.log(`Scheduler started with ${res.rows.length} active jobs`);
}
