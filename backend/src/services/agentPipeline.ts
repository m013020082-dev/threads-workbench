/**
 * AI Agent 產文 Pipeline（4 步驟）
 * Step 1: 抓話題
 * Step 2: 相關性評估
 * Step 3: 切入角度規劃
 * Step 4: 內容生成
 * Step 5: 內容審稿
 */

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_BASE_URL = 'https://api.minimax.chat/v1';

export async function callMiniMax(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
    body: JSON.stringify({
      model: 'MiniMax-M2.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`MiniMax API error ${res.status}`);
  const data = await res.json() as any;
  let content: string = data.choices?.[0]?.message?.content || '';
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function parseJSON<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : fallback;
  } catch {
    return fallback;
  }
}

export interface BrandProfile {
  profile_mode: string;
  brand_name: string;
  industry: string;
  tone_description: string;
  keywords: string;
  avoid_topics: string;
  target_audience: string;
  writing_directions: string;
  example_post: string;
  posting_notes: string;
  persona_name?: string;
  occupation?: string;
  personality?: string;
}

export interface TrendTopic {
  id?: string;
  title: string;
  description: string;
  source: string;
  trend_score: number;
}

export interface DraftOutput {
  trend_topic_id?: string;
  source_trend: string;
  relevance_score: number;
  angle: string;
  content: string;
  risk_level: 'low' | 'medium' | 'high';
  audit_notes: string;
  passed: boolean;
}

/** Step 2: 相關性評估 */
async function evaluateRelevance(brand: BrandProfile, topic: TrendTopic): Promise<{ score: number; reason: string; isRelevant: boolean }> {
  const displayName = brand.profile_mode === 'persona'
    ? `${brand.persona_name}（${brand.occupation}）`
    : `${brand.brand_name}（${brand.industry}）`;

  const result = await callMiniMax(
    '你是一位品牌內容策略師，負責評估熱門話題與品牌的相關性。',
    `品牌：${displayName}
語氣風格：${brand.tone_description}
核心關鍵字：${brand.keywords}
目標受眾：${brand.target_audience}
避免話題：${brand.avoid_topics}

熱門話題：${topic.title}
描述：${topic.description}

請評估相關性，只回傳 JSON：{"score":0-100的整數,"reason":"評估理由（50字以內）","isRelevant":true/false}`
  );

  return parseJSON(result, { score: 0, reason: '無法評估', isRelevant: false });
}

/** Step 3: 切入角度規劃 */
async function planAngles(brand: BrandProfile, topic: TrendTopic): Promise<{ angles: string[]; chosen: string; reasoning: string }> {
  const displayName = brand.profile_mode === 'persona'
    ? `${brand.persona_name}（${brand.occupation}）`
    : `${brand.brand_name}（${brand.industry}）`;

  const result = await callMiniMax(
    '你是一位品牌內容策略師，擅長將熱門話題轉化為品牌專業觀點。請以 JSON 格式回傳 3 個切入角度，並選出最佳的一個。',
    `品牌：${displayName}
語氣風格：${brand.tone_description}
目標受眾：${brand.target_audience}
熱門話題：${topic.title}
描述：${topic.description}

請提供 3 個不同的品牌切入角度，選出最適合的一個，只回傳 JSON：{"angles":["角度1","角度2","角度3"],"chosen":"最佳角度","reasoning":"選擇理由（30字以內）"}`
  );

  return parseJSON(result, { angles: ['直接分享觀點'], chosen: '直接分享觀點', reasoning: '最直接' });
}

/** Step 4: 內容生成 */
async function generateContent(brand: BrandProfile, topic: TrendTopic, chosenAngle: string): Promise<string> {
  const architectures = [
    { name: '超短鉤子型', wordCount: '30-80 字', logic: '一句 punch → 留白 → 讓人想回你', suitable: '情緒共鳴、神轉折、幽默自嘲、金句' },
    { name: '中短敘事型', wordCount: '70-180 字', logic: '開頭鉤子 → 事件/痛點 → 一句結論', suitable: '小故事、經驗分享、觀點輸出' },
    { name: '長文價值型', wordCount: '200-350 字', logic: '破題 → 3 個重點 → 收尾 CTA', suitable: '乾貨整理、專業觀點、教學拆解' },
  ];
  const arch = architectures[Math.floor(Math.random() * architectures.length)];

  const displayName = brand.profile_mode === 'persona'
    ? `${brand.persona_name}（${brand.occupation}）`
    : `${brand.brand_name}（${brand.industry}）`;

  const systemPrompt = `你是一位 Threads 貼文撰寫專家，使用繁體中文撰寫台灣口語風格的貼文。

必須遵守的產文規則：
- 不要加 hashtag（#標籤）
- 表情符號要克制，整篇最多 2-3 個，不要每句都加
- 用擬人、真實的口吻撰寫，像真人在說話，不要像廣告文案，不要官腔
- 每一句話獨立一行，句子之間空一行
- 不要使用逗點、句點，直接換行
- 問句全篇最多 0-2 個
- 最後一句要留互動鉤子（例如：你有類似的經驗嗎？你覺得呢？有問題歡迎留言）`;

  const result = await callMiniMax(systemPrompt,
    `品牌：${displayName}
語氣：${brand.tone_description}
參考範例貼文風格：${brand.example_post || '無'}
熱門話題：${topic.title}
切入角度：${chosenAngle}
額外產文備註（請嚴格遵守）：${brand.posting_notes || '無'}

【本次架構：${arch.name}】
字數：${arch.wordCount}
邏輯：${arch.logic}
適合：${arch.suitable}

請撰寫一則 Threads 貼文，只回傳 JSON：{"content":"完整貼文內容（一句話一行，不含 hashtag）","hook":"開頭吸引句（前20字）"}`
  );

  const parsed = parseJSON<{ content?: string }>(result, {});
  return parsed.content || result.replace(/^["']|["']$/g, '').trim();
}

/** Step 5: 內容審稿 */
async function auditContent(brand: BrandProfile, content: string): Promise<{
  passed: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  issues: string[];
  notes: string;
}> {
  const displayName = brand.profile_mode === 'persona'
    ? `${brand.persona_name}（${brand.occupation}）`
    : `${brand.brand_name}（${brand.industry}）`;

  const result = await callMiniMax(
    '你是一位內容審稿員，負責審查社群媒體貼文的品質與風險。',
    `品牌：${displayName}
語氣風格：${brand.tone_description}
避免話題：${brand.avoid_topics}
待審稿貼文：
${content}

請從以下面向審查：
1. 是否像新聞搬運（非品牌觀點）
2. 是否內容空泛、缺乏價值
3. 是否符合品牌語氣
4. 是否有敏感/爭議/法律風險
5. 整體品質是否達標

只回傳 JSON：{"passed":true/false,"riskLevel":"low"/"medium"/"high","issues":["問題1"],"notes":"審稿摘要（50字以內）"}`
  );

  return parseJSON(result, { passed: true, riskLevel: 'low' as const, issues: [], notes: '通過審稿' });
}

/** 直接產文（跳過相關性評估），用於使用者手動輸入話題的 compose 場景 */
export async function composeForTopic(
  brand: BrandProfile,
  topic: TrendTopic
): Promise<DraftOutput | null> {
  // Step 3: 切入角度
  const angles = await planAngles(brand, topic);

  // Step 4: 內容生成
  const content = await generateContent(brand, topic, angles.chosen);
  if (!content || content.length < 10) {
    console.log(`[Compose] 話題 "${topic.title}" 產文失敗`);
    return null;
  }

  // Step 5: 審稿
  const audit = await auditContent(brand, content);

  return {
    trend_topic_id: topic.id,
    source_trend: topic.title,
    relevance_score: 100,
    angle: angles.chosen,
    content,
    risk_level: audit.riskLevel,
    audit_notes: audit.notes,
    passed: audit.passed,
  };
}

/** 執行完整 Pipeline，針對單一話題 */
export async function runPipelineForTopic(
  brand: BrandProfile,
  topic: TrendTopic
): Promise<DraftOutput | null> {
  // Step 2: 相關性評估
  const relevance = await evaluateRelevance(brand, topic);
  if (!relevance.isRelevant || relevance.score < 50) {
    console.log(`[Agent] 話題 "${topic.title}" 相關性不足 (${relevance.score})，跳過`);
    return null;
  }

  // Step 3: 切入角度
  const angles = await planAngles(brand, topic);

  // Step 4: 內容生成
  const content = await generateContent(brand, topic, angles.chosen);
  if (!content || content.length < 10) {
    console.log(`[Agent] 話題 "${topic.title}" 產文失敗，跳過`);
    return null;
  }

  // Step 5: 審稿
  const audit = await auditContent(brand, content);

  return {
    trend_topic_id: topic.id,
    source_trend: topic.title,
    relevance_score: relevance.score,
    angle: angles.chosen,
    content,
    risk_level: audit.riskLevel,
    audit_notes: audit.notes,
    passed: audit.passed,
  };
}
