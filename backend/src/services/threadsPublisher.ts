/**
 * Threads 官方 Graph API — 發布貼文
 * https://developers.facebook.com/docs/threads
 */

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

export interface ThreadsAccount {
  id: string;
  workspace_id: string;
  threads_user_id: string;
  threads_username: string;
  access_token: string;
  token_expires_at: number;
  profile_picture_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublishResult {
  success: boolean;
  threads_post_id?: string;
  error?: string;
}

/** 驗證 Access Token 並取得用戶資訊 */
export async function verifyTokenAndGetUser(accessToken: string): Promise<{
  threads_user_id: string;
  threads_username: string;
  profile_picture_url: string;
}> {
  const url = `${THREADS_API_BASE}/me?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Threads API error ${res.status}: ${err}`);
  }
  const data = await res.json() as any;
  return {
    threads_user_id: data.id || '',
    threads_username: data.username || '',
    profile_picture_url: data.threads_profile_picture_url || '',
  };
}

/** 刷新 Long-lived Access Token */
export async function refreshAccessToken(accessToken: string): Promise<{
  access_token: string;
  token_expires_at: number;
}> {
  const url = `${THREADS_API_BASE.replace('/v1.0', '')}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed ${res.status}: ${err}`);
  }
  const data = await res.json() as any;
  const expiresInSeconds = data.expires_in || 5184000; // 60 days default
  return {
    access_token: data.access_token,
    token_expires_at: Date.now() + expiresInSeconds * 1000,
  };
}

/** 發布純文字貼文（兩步驟流程） */
export async function publishTextPost(
  threadsUserId: string,
  accessToken: string,
  content: string
): Promise<PublishResult> {
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

    const createData = await createRes.json() as any;
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

    const publishData = await publishRes.json() as any;
    return { success: true, threads_post_id: publishData.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
