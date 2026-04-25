"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("./db/client");
const migrate_1 = require("./db/migrate");
const schedulerService_1 = require("./services/schedulerService");
const search_1 = __importDefault(require("./routes/search"));
const drafts_1 = __importDefault(require("./routes/drafts"));
const queue_1 = __importDefault(require("./routes/queue"));
const scheduler_1 = __importDefault(require("./routes/scheduler"));
const workspace_1 = __importDefault(require("./routes/workspace"));
const auth_1 = __importDefault(require("./routes/auth"));
const execute_1 = __importDefault(require("./routes/execute"));
const radar_1 = __importDefault(require("./routes/radar"));
const publisher_1 = __importDefault(require("./routes/publisher"));
const googleAuth_1 = __importDefault(require("./routes/googleAuth"));
const stocks_1 = __importDefault(require("./routes/stocks"));
const client_2 = require("./db/client");
const threadsApiService_1 = require("./services/threadsApiService");
const antiSpamService_1 = require("./services/antiSpamService");
/** 每分鐘執行到期的排程貼文（官方 API 模式） */
let autoPublishInterval = null;
function startAutoPublishLoop() {
    autoPublishInterval = setInterval(async () => {
        try {
            const now = Date.now();
            const pending = await (0, client_2.query)("SELECT * FROM auto_scheduled_posts WHERE status='pending' AND scheduled_at <= $1", [now]);
            for (const post of pending.rows) {
                const content = (0, antiSpamService_1.convertToTraditional)(post.content);
                const result = await (0, threadsApiService_1.publishViaApi)(content);
                if (result.success) {
                    await (0, client_2.query)("UPDATE auto_scheduled_posts SET status='published', published_at=$1, updated_at=NOW() WHERE id=$2", [now, post.id]);
                    await (0, client_2.query)("INSERT INTO auto_post_history (id, workspace_id, publisher_account_id, content, threads_post_id, status, published_at) VALUES (gen_random_uuid(),$1,NULL,$2,'','success',$3)", [post.workspace_id, post.content, now]);
                }
                else {
                    await (0, client_2.query)("UPDATE auto_scheduled_posts SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2", [result.error, post.id]);
                }
            }
            if (pending.rows.length > 0)
                console.log(`[AutoPublish] 處理 ${pending.rows.length} 則排程貼文`);
        }
        catch (err) {
            console.error('[AutoPublish] 排程執行錯誤:', err);
        }
    }, 60000);
    console.log('[AutoPublish] 排程自動發布已啟動（每分鐘執行，官方 API 模式）');
}
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL]
    : ['http://localhost:5173', 'http://localhost:5174'];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin))
            return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging middleware
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});
// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'threads-workbench-backend',
    });
});
// Routes — mounted with prefixes matching the frontend API client
app.use('/api', search_1.default); // /api/search, /api/score
app.use('/api', drafts_1.default); // /api/generate-drafts, /api/approve-draft, /api/drafts/:id
app.use('/api/queue', queue_1.default); // /api/queue, /api/queue/add, /api/queue/skip/:id
app.use('/api/workspace', workspace_1.default); // /api/workspace/create, /list, /switch, /:id/keywords
app.use('/api/scheduler', scheduler_1.default); // /api/scheduler/create, /list, /toggle/:id
app.use('/api/auth', auth_1.default); // /api/auth/status, /login, /logout
app.use('/api/auth/google', googleAuth_1.default); // /api/auth/google/login, /callback, /me
app.use('/api/execute', execute_1.default); // /api/execute/start, /confirm, /cancel, /status
app.use('/api/radar', radar_1.default); // /api/radar/execute/start, /confirm, /cancel, /status
app.use('/api/pub', publisher_1.default); // /api/pub/accounts, /brand-profile, /trending, /compose, /publish, /drafts, /agent
app.use('/api/stocks', stocks_1.default); // /api/stocks/industry-analysis, /screen, /disclaimer
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
});
// Start server
async function main() {
    console.log('Starting Threads Precision Engagement Workbench Backend...');
    const dbConnected = await (0, client_1.checkConnection)();
    if (!dbConnected) {
        console.warn('WARNING: Database connection failed. Running without DB persistence.');
        console.warn('Please set DATABASE_URL in your .env file and ensure PostgreSQL is running.');
    }
    else {
        console.log('Database connection established.');
        await (0, migrate_1.runMigrations)();
        await (0, client_1.ensureSchema)();
        try {
            await (0, schedulerService_1.startScheduler)();
        }
        catch (err) {
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
    if (autoPublishInterval)
        clearInterval(autoPublishInterval);
    process.exit(0);
});
process.on('SIGINT', () => {
    if (autoPublishInterval)
        clearInterval(autoPublishInterval);
    process.exit(0);
});
main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
exports.default = app;
