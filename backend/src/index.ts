import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { checkConnection, ensureSchema } from './db/client';
import { startScheduler } from './services/schedulerService';
import searchRouter from './routes/search';
import draftsRouter from './routes/drafts';
import queueRouter from './routes/queue';
import schedulerRouter from './routes/scheduler';
import workspaceRouter from './routes/workspace';
import authRouter from './routes/auth';
import executeRouter from './routes/execute';
import radarRouter from './routes/radar';
import publisherRouter from './routes/publisher';
import { query } from './db/client';
import { publishViaApi } from './services/threadsApiService';

/** 每分鐘執行到期的排程貼文（官方 API 模式） */
let autoPublishInterval: NodeJS.Timeout | null = null;

function startAutoPublishLoop() {
  autoPublishInterval = setInterval(async () => {
    try {
      const now = Date.now();
      const pending = await query(
        "SELECT * FROM auto_scheduled_posts WHERE status='pending' AND scheduled_at <= $1",
        [now]
      );
      for (const post of pending.rows) {
        const result = await publishViaApi(post.content);
        if (result.success) {
          await query(
            "UPDATE auto_scheduled_posts SET status='published', published_at=$1, updated_at=NOW() WHERE id=$2",
            [now, post.id]
          );
          await query(
            "INSERT INTO auto_post_history (id, workspace_id, publisher_account_id, content, threads_post_id, status, published_at) VALUES (gen_random_uuid(),$1,NULL,$2,'','success',$3)",
            [post.workspace_id, post.content, now]
          );
        } else {
          await query(
            "UPDATE auto_scheduled_posts SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2",
            [result.error, post.id]
          );
        }
      }
      if (pending.rows.length > 0) console.log(`[AutoPublish] 處理 ${pending.rows.length} 則排程貼文`);
    } catch (err) {
      console.error('[AutoPublish] 排程執行錯誤:', err);
    }
  }, 60000);
  console.log('[AutoPublish] 排程自動發布已啟動（每分鐘執行，官方 API 模式）');
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'threads-workbench-backend',
  });
});

// Routes — mounted with prefixes matching the frontend API client
app.use('/api', searchRouter);              // /api/search, /api/score
app.use('/api', draftsRouter);              // /api/generate-drafts, /api/approve-draft, /api/drafts/:id
app.use('/api/queue', queueRouter);         // /api/queue, /api/queue/add, /api/queue/skip/:id
app.use('/api/workspace', workspaceRouter); // /api/workspace/create, /list, /switch, /:id/keywords
app.use('/api/scheduler', schedulerRouter); // /api/scheduler/create, /list, /toggle/:id
app.use('/api/auth', authRouter);           // /api/auth/status, /login, /logout
app.use('/api/execute', executeRouter);     // /api/execute/start, /confirm, /cancel, /status
app.use('/api/radar', radarRouter);         // /api/radar/execute/start, /confirm, /cancel, /status
app.use('/api/pub', publisherRouter);       // /api/pub/accounts, /brand-profile, /trending, /compose, /publish, /drafts, /agent

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV !== 'production' ? err.message : undefined,
  });
});

// Start server
async function main() {
  console.log('Starting Threads Precision Engagement Workbench Backend...');

  const dbConnected = await checkConnection();
  if (!dbConnected) {
    console.warn('WARNING: Database connection failed. Running without DB persistence.');
    console.warn('Please set DATABASE_URL in your .env file and ensure PostgreSQL is running.');
  } else {
    console.log('Database connection established.');
    await ensureSchema();
    try {
      await startScheduler();
    } catch (err) {
      console.error('Failed to start scheduler:', err);
    }
    // Auto-publish scheduled posts every minute
    startAutoPublishLoop();
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

// Bug #11：優雅關閉 — 清除 AutoPublish interval
process.on('SIGTERM', () => {
  if (autoPublishInterval) clearInterval(autoPublishInterval);
  process.exit(0);
});
process.on('SIGINT', () => {
  if (autoPublishInterval) clearInterval(autoPublishInterval);
  process.exit(0);
});

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

export default app;
