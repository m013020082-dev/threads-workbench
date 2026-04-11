import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import { signToken } from '../middleware/auth';
import https from 'https';

const router = Router();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/api/auth/github/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function httpsGet(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'threads-workbench', ...headers } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
  });
}

function httpsPost(url: string, body: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'threads-workbench', Accept: 'application/json', ...headers },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// GET /api/auth/google/login — redirect to GitHub OAuth
router.get('/login', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'read:user user:email',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /api/auth/google/callback — GitHub redirects here
router.get('/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${FRONTEND_URL}/login?error=cancelled`);

  try {
    // Exchange code for access token
    const tokenData = await httpsPost(
      'https://github.com/login/oauth/access_token',
      JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT_URI })
    );

    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error('No access token');

    // Get user info
    const ghUser = await httpsGet('https://api.github.com/user', { Authorization: `Bearer ${accessToken}` });

    // Get primary email
    const emails = await httpsGet('https://api.github.com/user/emails', { Authorization: `Bearer ${accessToken}` });
    const primaryEmail = Array.isArray(emails)
      ? (emails.find((e: any) => e.primary)?.email || emails[0]?.email || `${ghUser.id}@github.local`)
      : `${ghUser.id}@github.local`;

    const githubId = String(ghUser.id);
    const name = ghUser.name || ghUser.login;
    const picture = ghUser.avatar_url || '';

    // Upsert user
    const result = await query(
      `INSERT INTO users (google_id, email, name, picture, last_login)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (google_id) DO UPDATE
         SET email = $2, name = $3, picture = $4, last_login = NOW()
       RETURNING id, email, name, picture`,
      [githubId, primaryEmail, name, picture]
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, email: user.email, name: user.name, picture: user.picture });
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error('[GitHubAuth] callback error:', err);
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
});

// GET /api/auth/google/me
router.get('/me', (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ user: null });
  const { requireAuth } = require('../middleware/auth');
  requireAuth(req, res, () => res.json({ user: req.user }));
});

export default router;
