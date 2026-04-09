/**
 * 抓取 Google Trends 台灣熱搜話題（RSS）
 * Fallback：用 MiniMax 根據品牌設定生成話題
 */

import { convertToTraditional } from './antiSpamService';

const MINIMAX_BASE_URL = 'https://api.minimax.chat/v1';

export interface TrendTopic {
  title: string;
  description: string;
  source: 'google_trends' | 'ai_generated';
  trend_score: number;
}

/** 解析 Google Trends RSS XML */
function parseRSS(xml: string): TrendTopic[] {
  const items: TrendTopic[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  let score = 100;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                   block.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || '';
    const desc = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                  block.match(/<description>(.*?)<\/description>/))?.[1]?.trim() || '';
    if (title) {
      items.push({ title, description: desc.substring(0, 100), source: 'google_trends', trend_score: score });
      score = Math.max(10, score - 5);
    }
  }
  return items;
}

/** 從 Google Trends RSS 抓取台灣熱搜 */
async function fetchGoogleTrends(): Promise<TrendTopic[]> {
  const url = 'https://trends.google.com/trending/rss?geo=TW';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  const topics = parseRSS(xml);
  if (topics.length === 0) throw new Error('No topics parsed from RSS');
  return topics;
}

/** MiniMax Fallback：根據品牌設定生成話題 */
export async function generateTopicsWithAI(brandInfo: {
  brand_name: string;
  industry: string;
  target_audience: string;
}, count = 8): Promise<TrendTopic[]> {
  const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
  if (!MINIMAX_API_KEY) {
    return getDefaultTopics();
  }

  const prompt = `你是一位社群媒體趨勢分析師。
請根據以下品牌資訊，生成 ${count} 個適合在 Threads 上發文的話題，話題要多元不重複。
品牌：${brandInfo.brand_name}（${brandInfo.industry}）
目標受眾：${brandInfo.target_audience}
只回傳以下 JSON，不要其他文字：
{"topics":[{"title":"話題標題","description":"話題說明（30字以內）"}]}`;

  const res = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
    body: JSON.stringify({
      model: 'MiniMax-M2.5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!res.ok) return getDefaultTopics();
  const data = await res.json() as any;
  let content: string = data.choices?.[0]?.message?.content || '{}';
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  try {
    const match = content.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    const topics = parsed.topics || [];
    return topics.map((t: any, i: number) => ({
      title: convertToTraditional(t.title || ''),
      description: convertToTraditional(t.description || ''),
      source: 'ai_generated' as const,
      trend_score: 80 - i * 5,
    }));
  } catch {
    return getDefaultTopics();
  }
}

function getDefaultTopics(): TrendTopic[] {
  return [
    { title: 'AI 工具應用', description: 'ChatGPT、Claude 等 AI 工具在日常工作的應用', source: 'ai_generated', trend_score: 90 },
    { title: '台灣科技新創', description: '台灣科技創業生態與機會', source: 'ai_generated', trend_score: 85 },
    { title: '職場生產力', description: '提升工作效率的方法與工具', source: 'ai_generated', trend_score: 80 },
    { title: '數位行銷趨勢', description: '社群媒體與內容行銷的最新趨勢', source: 'ai_generated', trend_score: 75 },
    { title: '永續消費', description: '環境友善的生活方式與消費選擇', source: 'ai_generated', trend_score: 70 },
  ];
}

/** 主函式：Google Trends + AI 品牌話題混合 */
export async function fetchTrendingTopics(brandInfo?: {
  brand_name: string;
  industry: string;
  target_audience: string;
}): Promise<TrendTopic[]> {
  const info = brandInfo || { brand_name: '品牌', industry: '科技', target_audience: '台灣用戶' };

  // 同時抓取 Google Trends 與 AI 品牌話題
  const [googleTopics, aiTopics] = await Promise.allSettled([
    fetchGoogleTrends(),
    generateTopicsWithAI(info),
  ]);

  const google = googleTopics.status === 'fulfilled' ? googleTopics.value : [];
  const ai = aiTopics.status === 'fulfilled' ? aiTopics.value : getDefaultTopics();

  if (google.length > 0) {
    console.log(`[Trends] Google Trends RSS 抓到 ${google.length} 個話題，AI 補充 ${ai.length} 個品牌話題`);
    // Google Trends 前 10 + AI 品牌話題，去除重複
    return [...google.slice(0, 10), ...ai].slice(0, 20);
  } else {
    console.log(`[Trends] Google Trends 失敗，使用 AI 生成 ${ai.length} 個品牌話題`);
    return ai;
  }
}
