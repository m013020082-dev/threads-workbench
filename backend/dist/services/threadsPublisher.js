"use strict";
/**
 * Threads 官方 Graph API — 發布貼文
 * https://developers.facebook.com/docs/threads
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTokenAndGetUser = verifyTokenAndGetUser;
exports.refreshAccessToken = refreshAccessToken;
exports.publishTextPost = publishTextPost;
const THREADS_API_BASE = 'https://graph.threads.net/v1.0';
/** 驗證 Access Token 並取得用戶資訊 */
async function verifyTokenAndGetUser(accessToken) {
    const url = `${THREADS_API_BASE}/me?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Threads API error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return {
        threads_user_id: data.id || '',
        threads_username: data.username || '',
        profile_picture_url: data.threads_profile_picture_url || '',
    };
}
/** 刷新 Long-lived Access Token */
async function refreshAccessToken(accessToken) {
    const url = `${THREADS_API_BASE.replace('/v1.0', '')}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Token refresh failed ${res.status}: ${err}`);
    }
    const data = await res.json();
    const expiresInSeconds = data.expires_in || 5184000; // 60 days default
    return {
        access_token: data.access_token,
        token_expires_at: Date.now() + expiresInSeconds * 1000,
    };
}
/** 發布純文字貼文（兩步驟流程） */
async function publishTextPost(threadsUserId, accessToken, content) {
    try {
        // Step 1: 建立 Container
        const createRes = await fetch(`${THREADS_API_BASE}/${threadsUserId}/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                media_type: 'TEXT',
                text: content,
                access_token: accessToken,
            }),
        });
        if (!createRes.ok) {
            const err = await createRes.text();
            return { success: false, error: `建立 Container 失敗 (${createRes.status}): ${err}` };
        }
        const createData = await createRes.json();
        const containerId = createData.id;
        if (!containerId) {
            return { success: false, error: '無法取得 Container ID' };
        }
        // Step 2: 發布 Container
        await new Promise(r => setTimeout(r, 2000)); // wait 2s as recommended
        const publishRes = await fetch(`${THREADS_API_BASE}/${threadsUserId}/threads_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: containerId,
                access_token: accessToken,
            }),
        });
        if (!publishRes.ok) {
            const err = await publishRes.text();
            return { success: false, error: `發布失敗 (${publishRes.status}): ${err}` };
        }
        const publishData = await publishRes.json();
        return { success: true, threads_post_id: publishData.id };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
