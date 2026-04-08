# Threads Precision Engagement Workbench

A full-stack web application for discovering, ranking, and crafting high-quality reply drafts for Threads posts. All engagement is manual — the tool never auto-posts.

## Architecture

- **Backend**: Node.js + Express + TypeScript + PostgreSQL
- **Frontend**: React + TypeScript + TailwindCSS + Vite
- **AI**: Anthropic Claude (claude-haiku-4-5) for draft generation

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- An Anthropic API key

### 1. Database Setup

Create the database and run the migration:

```bash
createdb threads_workbench
psql -d threads_workbench -f backend/src/db/migrations/001_initial.sql
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your values
npm install
npm run dev
```

The backend runs on `http://localhost:3001`.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `PORT` | Backend port (default: 3001) |

## Features

### Workspaces
- Create multiple workspaces with different brand voices and keyword sets
- Switch between workspaces instantly

### Search & Ranking
- Search posts from the database by keywords and time range
- Filter by minimum engagement count and follower range
- Automatic scoring: keyword relevance (40pts) + engagement (30pts) + followers (20pts) + reply ratio (10pts)
- Mock post generator creates sample posts for testing without a live Threads connection

### Draft Generation
- Uses Anthropic Claude (claude-haiku-4-5) to generate 4 distinct comment drafts per post
- Styles: professional, casual, witty, empathetic, educational
- Lengths: short (20-50 words), medium (50-120 words), long (120-200 words)
- Anti-spam checking: similarity detection, keyword stuffing, spam term blocking

### Review Queue
- Posts move into the queue after drafts are generated
- Review and approve the best draft
- "Manual posting required" warning is always visible

### Execution Panel
- Shows the selected post URL and approved draft
- "Open Post in Browser" button — opens the thread
- "Copy Draft" button — copies draft to clipboard
- **No auto-post button** — you must paste and submit manually

### Scheduler
- Schedule automated search, scoring, and draft generation jobs
- Cron-based scheduling with preset options
- **Strictly limited** to search/score/draft — posting is never automated

## API Endpoints

### Workspaces
- `POST /api/workspace/create` — create workspace
- `GET /api/workspace/list` — list all workspaces
- `POST /api/workspace/switch` — switch active workspace
- `GET /api/workspace/:id/keywords` — get workspace keywords

### Search & Score
- `POST /api/search` — search and rank posts
- `POST /api/score` — score existing posts

### Drafts
- `POST /api/generate-drafts` — generate AI drafts
- `POST /api/approve-draft` — approve a draft
- `GET /api/drafts/:postId` — get drafts for a post

### Queue
- `GET /api/queue` — get review queue
- `POST /api/queue/add` — add post to queue
- `POST /api/queue/skip/:postId` — skip a post

### Scheduler
- `POST /api/scheduler/create` — create scheduled job
- `GET /api/scheduler/list` — list scheduled jobs
- `POST /api/scheduler/toggle/:jobId` — enable/disable job

## Design Principles

1. **No auto-posting** — The tool assists with research and drafting only. All engagement is performed manually by the user.
2. **Anti-spam by design** — Similarity scoring, spam term detection, and keyword stuffing checks are built into every draft.
3. **Workspace isolation** — Keywords, posts, drafts, and interactions are scoped per workspace.
4. **Scheduler safety** — The scheduler is strictly limited to search, score, and draft operations. Posting is never automated.
