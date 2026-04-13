"use strict";
/**
 * AI Agent 產文 Pipeline（4 步驟）
 * Step 1: 抓話題
 * Step 2: 相關性評估
 * Step 3: 切入角度規劃
 * Step 4: 內容生成
 * Step 5: 內容審稿
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.callMiniMax = callMiniMax;
exports.composeForTopic = composeForTopic;
exports.runPipelineForTopic = runPipelineForTopic;
const antiSpamService_1 = require("./antiSpamService");
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_BASE_URL = 'https://api.minimax.chat/v1';
const TC_ENFORCE = '【強制規定】所有回應必須使用繁體中文（台灣正體），嚴格禁止出現任何簡體字。';
async function callMiniMax(systemPrompt, userPrompt) {
    const res = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
        body: JSON.stringify({
            model: 'MiniMax-M2.7-highspeed',
            messages: [
                { role: 'system', content: `${TC_ENFORCE}\n\n${systemPrompt}` },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 4096,
            temperature: 0.8,
        }),
    });
    if (!res.ok)
        throw new Error(`MiniMax API error ${res.status}`);
    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || '';
    return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}
function parseJSON(text, fallback) {
    try {
        const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : fallback;
    }
    catch {
        return fallback;
    }
}
/** Step 2: 相關性評估 */
async function evaluateRelevance(brand, topic) {
    const displayName = brand.profile_mode === 'persona'
        ? `${brand.persona_name}（${brand.occupation}）`
        : `${brand.brand_name}（${brand.industry}）`;
    const result = await callMiniMax('你是一位品牌內容策略師，負責評估熱門話題與品牌的相關性。請嚴格使用繁體中文（台灣用字）回應，禁止出現任何簡體字。', `品牌：${displayName}
語氣風格：${brand.tone_description}
核心關鍵字：${brand.keywords}
目標受眾：${brand.target_audience}
避免話題：${brand.avoid_topics}

熱門話題：${topic.title}
描述：${topic.description}

請評估相關性，只回傳 JSON：{"score":0-100的整數,"reason":"評估理由（50字以內）","isRelevant":true/false}`);
    const parsed = parseJSON(result, { score: 0, reason: '無法評估', isRelevant: false });
    parsed.reason = (0, antiSpamService_1.convertToTraditional)(parsed.reason);
    return parsed;
}
/** Step 3: 切入角度規劃 */
async function planAngles(brand, topic) {
    const displayName = brand.profile_mode === 'persona'
        ? `${brand.persona_name}（${brand.occupation}）`
        : `${brand.brand_name}（${brand.industry}）`;
    const result = await callMiniMax('你是一位品牌內容策略師，擅長將熱門話題轉化為品牌專業觀點。請以 JSON 格式回傳 3 個切入角度，並選出最佳的一個。請嚴格使用繁體中文（台灣用字）回應，禁止出現任何簡體字。', `品牌：${displayName}
語氣風格：${brand.tone_description}
目標受眾：${brand.target_audience}
熱門話題：${topic.title}
描述：${topic.description}

請提供 3 個不同的品牌切入角度，選出最適合的一個，只回傳 JSON：{"angles":["角度1","角度2","角度3"],"chosen":"最佳角度","reasoning":"選擇理由（30字以內）"}`);
    const parsed = parseJSON(result, { angles: ['直接分享觀點'], chosen: '直接分享觀點', reasoning: '最直接' });
    parsed.angles = parsed.angles.map((a) => (0, antiSpamService_1.convertToTraditional)(a));
    parsed.chosen = (0, antiSpamService_1.convertToTraditional)(parsed.chosen);
    parsed.reasoning = (0, antiSpamService_1.convertToTraditional)(parsed.reasoning);
    return parsed;
}
/** Step 4: 內容生成 */
async function generateContent(brand, topic, chosenAngle) {
    const displayName = brand.profile_mode === 'persona'
        ? `${brand.persona_name}（${brand.occupation}）`
        : `${brand.brand_name}（${brand.industry}）`;
    const systemPrompt = `你是一個真實的 Threads 用戶，用台灣日常口語寫貼文。請嚴格使用繁體中文（台灣用字），禁止出現任何簡體字。

【寫作規則】
- 開場用口語帶入：「有人跟我一樣嗎」「最近才發現」「說真的」這類自然開頭
- 描述日常感受，用生活小情節，例如「晚上腦袋停不下來」「滑手機滑到焦慮」
- 用「結果」「然後」「但」「欸」這類口語轉折，讓句子像真人在講話
- 可以有小反差或輕鬆結尾，例如「看起來沒怎樣但一直有在進步」
- 字數 30 到 90 字，不要超過
- 【格式強制規定】一句話 = 一行。句子結束立刻換行，下一句從新的一行開始。每行之間空一行。
- 錯誤示範（禁止）：「說真的我之前以為很簡單，結果根本不是這樣。」（兩句在同一行）
- 正確示範（必須）：「說真的我之前以為很簡單。\n\n結果根本不是這樣。」
- 標點符號只允許四種：逗號「，」、句號「。」、問號「？」、冒號「:」，其他所有標點（頓號、括號、引號、破折號、驚嘆號、省略號、書名號等）一律用空白取代，不要出現
- 冒號用在說話引導或轉折強調，例如「你說: 太酷了吧」「我在想: 這樣對嗎」「結果發現: 根本沒差」
- 偶爾用提問收尾，讓讀者有參與感
- 不要加 hashtag
- 表情符號最多 2 個，不要每句都放
- 不要寫得像廣告、官方文案或條列式乾貨
- 只輸出貼文本身，不要加任何說明文字、引號、前言`;
    const result = await callMiniMax(systemPrompt, `品牌身份：${displayName}
語氣風格：${brand.tone_description}
${brand.example_post ? `參考貼文風格（模仿這個人的語氣）：${brand.example_post}` : ''}
話題：${topic.title}
切入角度：${chosenAngle}
${brand.posting_notes ? `額外要求（必須遵守）：${brand.posting_notes}` : ''}

請直接寫出貼文內容，不要有任何其他文字。`);
    const cleaned = result
        .replace(/<br\s*\/?>/gi, '\n') // <br> 轉換為換行
        .replace(/<[^>]+>/g, '') // 移除所有其他 HTML tag
        .replace(/\*\*/g, '') // 移除 markdown bold
        .replace(/#{1,6}\s/g, '') // 移除 markdown heading
        .trim();
    return (0, antiSpamService_1.convertToTraditional)(cleaned);
}
/** Step 5: 內容審稿 */
async function auditContent(brand, content) {
    const displayName = brand.profile_mode === 'persona'
        ? `${brand.persona_name}（${brand.occupation}）`
        : `${brand.brand_name}（${brand.industry}）`;
    const result = await callMiniMax('你是一位內容審稿員，負責審查社群媒體貼文的品質與風險。請嚴格使用繁體中文（台灣用字）回應，禁止出現任何簡體字。', `品牌：${displayName}
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

只回傳 JSON：{"passed":true/false,"riskLevel":"low"/"medium"/"high","issues":["問題1"],"notes":"審稿摘要（50字以內）"}`);
    const auditParsed = parseJSON(result, { passed: true, riskLevel: 'low', issues: [], notes: '通過審稿' });
    auditParsed.notes = (0, antiSpamService_1.convertToTraditional)(auditParsed.notes);
    auditParsed.issues = auditParsed.issues.map((issue) => (0, antiSpamService_1.convertToTraditional)(issue));
    return auditParsed;
}
/** 直接產文（跳過相關性評估），用於使用者手動輸入話題的 compose 場景 */
async function composeForTopic(brand, topic) {
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
        source_trend: (0, antiSpamService_1.convertToTraditional)(topic.title),
        relevance_score: 100,
        angle: (0, antiSpamService_1.convertToTraditional)(angles.chosen),
        content: (0, antiSpamService_1.convertToTraditional)(content),
        risk_level: audit.riskLevel,
        audit_notes: (0, antiSpamService_1.convertToTraditional)(audit.notes),
        passed: audit.passed,
    };
}
/** 執行完整 Pipeline，針對單一話題 */
async function runPipelineForTopic(brand, topic) {
    // Step 2: 相關性評估（AI 生成話題已針對品牌，跳過篩選；Google Trends 才需要）
    let relevanceScore = 100;
    if (topic.source === 'google_trends') {
        const relevance = await evaluateRelevance(brand, topic);
        if (!relevance.isRelevant || relevance.score < 30) {
            console.log(`[Agent] 話題 "${topic.title}" 相關性不足 (${relevance.score})，跳過`);
            return null;
        }
        relevanceScore = relevance.score;
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
        source_trend: (0, antiSpamService_1.convertToTraditional)(topic.title),
        relevance_score: relevanceScore,
        angle: (0, antiSpamService_1.convertToTraditional)(angles.chosen),
        content: (0, antiSpamService_1.convertToTraditional)(content),
        risk_level: audit.riskLevel,
        audit_notes: (0, antiSpamService_1.convertToTraditional)(audit.notes),
        passed: audit.passed,
    };
}
