import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db/client';
import { signToken } from '../middleware/auth';

const router = Router();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function getOAuthClient() {
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// GET /api/auth/google/login — redirect to Google
router.get('/login', (_req: Request, res: Response) => {
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
  res.redirect(url);
});

// GET /api/auth/google/callback — Google redirects here
router.get('/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${FRONTEND_URL}/login?error=cancelled`);
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);

    // Get user info from ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload()!;

    const googleId = payload.sub;
    const email = payload.email!;
    const name = payload.name || email;
    const picture = payload.picture || '';

    // Upsert user
    const result = await query(
      `INSERT INTO users (google_id, email, name, picture, last_login)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (google_id) DO UPDATE
         SET email = $2, name = $3, picture = $4, last_login = NOW()
       RETURNING id, email, name, picture`,
      [googleId, email, name, picture]
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, email: user.email, name: user.name, picture: user.picture });

    // Redirect frontend with token
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error('[GoogleAuth] callback error:', err);
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
});

// GET /api/auth/google/me — verify token and return user info
router.get('/me', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ user: null });
  }
  try {
    const { requireAuth } = await import('../middleware/auth');
    requireAuth(req, res, () => {
      res.json({ user: req.user });
    });
  } catch {
    res.status(401).json({ user: null });
  }
});

export default router;
