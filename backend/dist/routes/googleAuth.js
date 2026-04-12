"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const google_auth_library_1 = require("google-auth-library");
const client_1 = require("../db/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const oauth2Client = new google_auth_library_1.OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
// GET /api/auth/google/login — redirect to Google OAuth
router.get('/login', (_req, res) => {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.status(500).json({ error: 'Google OAuth 未設定，請在 .env 填入 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET' });
    }
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['openid', 'email', 'profile'],
        prompt: 'select_account',
    });
    res.redirect(url);
});
// GET /api/auth/google/callback — Google redirects here
router.get('/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error || !code)
        return res.redirect(`${FRONTEND_URL}/login?error=cancelled`);
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        if (!tokens.id_token)
            throw new Error('No id_token returned');
        const ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload)
            throw new Error('Invalid token payload');
        const googleId = payload.sub;
        const email = payload.email || `${googleId}@google.local`;
        const name = payload.name || email;
        const picture = payload.picture || '';
        const result = await (0, client_1.query)(`INSERT INTO users (google_id, email, name, picture, last_login)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (google_id) DO UPDATE
         SET email = $2, name = $3, picture = $4, last_login = NOW()
       RETURNING id, email, name, picture`, [googleId, email, name, picture]);
        const user = result.rows[0];
        const token = (0, auth_1.signToken)({ id: user.id, email: user.email, name: user.name, picture: user.picture });
        res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
    }
    catch (err) {
        console.error('[GoogleAuth] callback error:', err);
        res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
    }
});
// GET /api/auth/google/me
router.get('/me', auth_1.requireAuth, (req, res) => {
    res.json({ user: req.user });
});
exports.default = router;
