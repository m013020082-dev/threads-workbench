"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDrafts = generateDrafts;
const antiSpamService_1 = require("./antiSpamService");
const client_1 = require("../db/client");
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_BASE_URL = 'https://api.minimax.chat/v1';
const MINIMAX_MODEL = 'MiniMax-M2.7-Flash';
const SYSTEM_PROMPT_TC = '你必須嚴格使用繁體中文（台灣用字）回應，絕對禁止出現任何簡體字。';
async function callClaude(prompt) {
    const res = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        },
        body: JSON.stringify({
            model: MINIMAX_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT_TC },
                { role: 'user', content: prompt },
            ],
            max_tokens: 4096,
            temperature: 0.8,
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`MiniMax API error ${res.status}: ${err}`);
    }
    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return content;
}
async function generateDrafts(request) {
    // 抓取最近草稿，用於反垃圾郵件檢查
    const historyRes = await (0, client_1.query)('SELECT draft_text FROM drafts WHERE post_id != $1 ORDER BY created_at DESC LIMIT 20', [request.post_id]);
    const history = historyRes.rows.map((r) => r.draft_text);
    const lengthGuide = { short: '1-2 句', medium: '2-4 句', long: '4-6 句' };
    const emojiGuide = request.emoji_enabled ? '可以使用 1-2 個相關 emoji。' : '不要使用 emoji。';
    // 發文邏輯對應的具體指示
    const logicGuideMap = {
        '擬人幽默': `發文邏輯：擬人幽默
- 像真實台灣人在聊天，語氣輕鬆自然
- 可以用一點玩笑或諷刺，但不失禮貌
- 標點符號要少，不要每句後面都加「！」或「～」，也不要過多的「⋯」
- 不要用書面語，用口語白話文
- 不要太正式，不要「您好」「請問」這種開頭`,
        '專業分析': `發文邏輯：專業分析
- 提供有依據的觀點或數據補充
- 語氣偏正式但不冷漠
- 可以引用趨勢或案例來佐證
- 標點符號正常使用，語句完整`,
        '好奇提問': `發文邏輯：好奇提問
- 以真誠的問題帶動討論
- 表達自己的疑惑或好奇，引發對方回應
- 語氣輕鬆，不要審問感
- 標點符號少，問號用一個就好`,
        '情感共鳴': `發文邏輯：情感共鳴
- 先認同對方的感受或觀點
- 語氣溫暖親切，像在跟朋友說話
- 可以分享類似經驗拉近距離
- 標點符號適中，不誇張`,
        '簡短有力': `發文邏輯：簡短有力
- 只說一句話，直接切入重點
- 不廢話，不解釋，不鋪陳
- 語氣可以帶點個性或立場鮮明
- 完全不用多餘標點`,
    };
    const logicGuide = logicGuideMap[request.posting_logic || '擬人幽默']
        || logicGuideMap['擬人幽默'];
    const replyNoteSection = request.reply_note?.trim()
        ? `\n額外指示：${request.reply_note.trim()}`
        : '';
    const prompt = `你是一個幫助撰寫 Threads 留言回覆的助手。嚴格使用繁體中文（台灣用字），絕對禁止出現任何簡體字。若有用到「国、时、们、说、来、这、从、发、东、经、开、实、为、问」等簡體字，必須改為對應繁體字「國、時、們、說、來、這、從、發、東、經、開、實、為、問」。

${logicGuide}

品牌語氣補充：${request.brand_voice}
長度：${lengthGuide[request.length]}
${emojiGuide}${replyNoteSection}

原始貼文：
"${request.post_text}"

【格式強制規定】一句話 = 一行。句子結束立刻換行，下一句從新的一行開始。每行之間空一行。
禁止在同一行寫兩句話。例如「說真的不錯，然後我就買了。」要改成：
「說真的不錯。

然後我就買了。」

請生成 3 個不同角度的留言草稿，每個都要符合上面的發文邏輯。
不可帶有廣告或垃圾郵件性質。

請用以下格式輸出，不要有任何其他文字：
---1---
第一個留言草稿內容
---2---
第二個留言草稿內容
---3---
第三個留言草稿內容`;
    const raw = await callClaude(prompt);
    // 用分隔符解析，避免 JSON escape 導致奇怪符號
    const parts = raw.split(/---\d+---/).map(s => s.trim()).filter(Boolean);
    const drafts = parts.length >= 3 ? parts.slice(0, 3) : [raw.trim(), raw.trim(), raw.trim()];
    return drafts.map(text => {
        const converted = (0, antiSpamService_1.convertToTraditional)(text);
        const spam = (0, antiSpamService_1.checkAntiSpam)(converted, history);
        return {
            text: converted,
            style: request.style,
            similarity_score: spam.similarity_score,
            risk_notes: spam.warnings.join('; '),
        };
    });
}
