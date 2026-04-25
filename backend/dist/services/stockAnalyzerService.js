"use strict";
/**
 * 產業趨勢與選股研究助手
 *
 * 重要原則：
 * - 本服務僅產出「研究框架」與「公開資訊整理」，不提供買賣建議
 * - 所有輸出皆需附上免責聲明
 * - 不保證報酬率，不指名「起漲點」
 * - 內容定位為教育性質
 *
 * 使用 MiniMax 的 Anthropic-compatible endpoint:
 *   https://api.minimaxi.com/anthropic
 * 金鑰透過 MINIMAX_API_KEY 環境變數讀取，請勿硬編在程式碼中。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_DISCLAIMER = void 0;
exports.analyzeIndustry = analyzeIndustry;
exports.buildScreenerFramework = buildScreenerFramework;
exports.generateStockOpinion = generateStockOpinion;
exports.generateBacktestPlan = generateBacktestPlan;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const antiSpamService_1 = require("./antiSpamService");
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7-highspeed';
let _client = null;
function getClient() {
    if (!MINIMAX_API_KEY) {
        throw new Error('MINIMAX_API_KEY 未設定，請於 backend/.env 中設定後重啟後端');
    }
    if (!_client) {
        _client = new sdk_1.default({
            apiKey: MINIMAX_API_KEY,
            baseURL: MINIMAX_BASE_URL,
        });
    }
    return _client;
}
const SYSTEM_PROMPT_TC = '你必須嚴格使用繁體中文（台灣用字）回應，絕對禁止出現任何簡體字。' +
    '你是一位嚴謹的產業研究員，只整理公開資訊與分析框架，' +
    '絕不提供具體買賣建議、股價預測或保證報酬。';
exports.STOCK_DISCLAIMER = '⚠️ 本工具產出之內容為公開資訊整理與研究框架，僅供學術與教育參考。' +
    '不構成任何投資建議、股票推薦、買賣訊號或報酬保證。' +
    '所有投資決策請自行評估、自負盈虧，必要時諮詢合格之財務顧問。';
async function callMiniMax(prompt, maxTokens = 4096) {
    const client = getClient();
    const response = await client.messages.create({
        model: MINIMAX_MODEL,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT_TC,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
    });
    const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}
function extractJson(raw) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match)
        return null;
    try {
        return JSON.parse(match[0]);
    }
    catch {
        return null;
    }
}
async function analyzeIndustry(req) {
    const region = req.region || '台灣 / 全球';
    const horizon = req.horizon_years || 3;
    const industry = req.industry.trim();
    if (!industry) {
        throw new Error('industry 為必填欄位');
    }
    const prompt = `請以嚴謹產業研究員身分，分析以下產業的結構性趨勢。
這是教育性研究框架，不要給出買賣建議、不要預測股價、不要點名個股推薦。

產業：${industry}
地區範圍：${region}
觀察期間：未來 ${horizon} 年

請只輸出以下 JSON，不要任何其他文字：
{
  "thesis": "150 字內的核心觀點，描述為何此產業值得關注、結構性驅動因子為何",
  "growth_drivers": ["驅動因子 1", "驅動因子 2", "驅動因子 3", "驅動因子 4"],
  "value_chain": [
    { "stage": "上游環節名稱", "description": "20 字內描述" },
    { "stage": "中游環節名稱", "description": "20 字內描述" },
    { "stage": "下游環節名稱", "description": "20 字內描述" }
  ],
  "key_risks": ["風險 1", "風險 2", "風險 3", "風險 4"],
  "monitoring_indicators": [
    { "indicator": "可量化指標名稱", "meaning": "代表的意義" },
    { "indicator": "可量化指標名稱", "meaning": "代表的意義" },
    { "indicator": "可量化指標名稱", "meaning": "代表的意義" },
    { "indicator": "可量化指標名稱", "meaning": "代表的意義" }
  ],
  "example_themes": ["可進一步研究的子題 1", "子題 2", "子題 3"]
}

注意：可以提及產業中的知名公司作為「例子」說明商業模式，但不要使用「推薦」「買進」「目標價」「起漲點」等字眼。`;
    const raw = await callMiniMax(prompt, 4096);
    const parsed = extractJson(raw);
    if (!parsed) {
        throw new Error('AI 回應無法解析為 JSON，請重試或調整產業名稱');
    }
    const tc = (s) => (0, antiSpamService_1.convertToTraditional)(s || '');
    return {
        industry,
        region,
        horizon_years: horizon,
        thesis: tc(parsed.thesis),
        growth_drivers: (parsed.growth_drivers || []).map(tc),
        value_chain: (parsed.value_chain || []).map((v) => ({
            stage: tc(v.stage),
            description: tc(v.description),
        })),
        key_risks: (parsed.key_risks || []).map(tc),
        monitoring_indicators: (parsed.monitoring_indicators || []).map((m) => ({
            indicator: tc(m.indicator),
            meaning: tc(m.meaning),
        })),
        example_themes: (parsed.example_themes || []).map(tc),
        disclaimer: exports.STOCK_DISCLAIMER,
    };
}
async function buildScreenerFramework(criteria) {
    const industry = (criteria.industry || '').trim() || '未指定（廣泛市場）';
    const region = criteria.region || '台股 / 美股';
    const marketCap = criteria.market_cap || 'any';
    const growth = criteria.growth_profile || 'any';
    const notes = (criteria.notes || '').trim();
    const prompt = `請以產業研究員身分，根據下列篩選條件，產出「研究候選名單框架」。
這是教育性質的研究輔助，不是買賣建議。請特別注意：
- 例子公司只是用來說明商業模式類別，不代表推薦
- 必須附上「盡職調查清單」教使用者如何自行驗證
- 不要寫「起漲」「飆股」「預估報酬 X 倍」這類字眼

篩選條件：
- 產業：${industry}
- 市場：${region}
- 市值偏好：${marketCap}
- 成長型態：${growth}
- 額外備註：${notes || '無'}

請只輸出以下 JSON：
{
  "framework_summary": "100 字內，說明依此條件的研究方向與核心邏輯",
  "candidates": [
    {
      "category": "候選類別名稱（例：先進封裝設備、HBM 記憶體模組）",
      "rationale": "30 字內，說明為何符合條件",
      "example_companies": ["僅作為商業模式範例的公司 1", "公司 2"],
      "due_diligence_checklist": ["自行驗證項目 1", "項目 2", "項目 3"]
    }
  ],
  "red_flags": ["此類型公司常見的警訊 1", "警訊 2", "警訊 3"]
}

candidates 請給 3 至 5 個類別。`;
    const raw = await callMiniMax(prompt, 4096);
    const parsed = extractJson(raw);
    if (!parsed) {
        throw new Error('AI 回應無法解析為 JSON，請重試或調整篩選條件');
    }
    const tc = (s) => (0, antiSpamService_1.convertToTraditional)(s || '');
    return {
        criteria: { industry, region, market_cap: marketCap, growth_profile: growth, notes },
        framework_summary: tc(parsed.framework_summary),
        candidates: (parsed.candidates || []).map((c) => ({
            category: tc(c.category),
            rationale: tc(c.rationale),
            example_companies: (c.example_companies || []).map(tc),
            due_diligence_checklist: (c.due_diligence_checklist || []).map(tc),
        })),
        red_flags: (parsed.red_flags || []).map(tc),
        disclaimer: exports.STOCK_DISCLAIMER,
    };
}
async function generateStockOpinion(req) {
    const company = req.company.trim();
    if (!company) {
        throw new Error('company 為必填欄位');
    }
    const ticker = (req.ticker || '').trim();
    const region = req.region || '台股 / 美股';
    const prompt = `請以產業研究員身分，針對下列公司產出「分析觀點」。
這是 AI 的主觀觀點，使用者已知曉這不是投資建議、不保證準確、不構成買賣訊號。
請務必：
- 提出多空雙方論述（bull / bear）讓使用者自行判斷
- 不要寫「目標價」「建議買進」「保證」「飆股」「起漲」字眼
- 估值框架只給「方法論」（例如：適用 DCF 還是 PE 倍數），不要給具體數字目標
- 內容必須基於公開資訊與一般產業知識，不要捏造財報數字

公司：${company}${ticker ? `（代碼：${ticker}）` : ''}
市場：${region}

請只輸出以下 JSON：
{
  "business_model": "120 字內描述商業模式與營收來源",
  "moat": [
    { "factor": "護城河因子 1（例：規模經濟、網路效應、轉換成本、品牌、專利、特許）",
      "strength": "strong | medium | weak",
      "note": "20 字內補充" }
  ],
  "financial_focus": ["檢視財報時應重點觀察的項目 1", "項目 2", "項目 3", "項目 4"],
  "bull_case": "100 字內，看多方論述的核心邏輯",
  "bear_case": "100 字內，看空方論述的核心邏輯",
  "valuation_framework": "60 字內，建議使用何種估值方法與為什麼（例：成長股用 PEG、循環股用 P/B、現金流穩定用 DCF）",
  "watch_indicators": ["可量化追蹤指標 1", "指標 2", "指標 3"]
}

moat 請給 3 至 5 項。`;
    const raw = await callMiniMax(prompt, 4096);
    const parsed = extractJson(raw);
    if (!parsed) {
        throw new Error('AI 回應無法解析為 JSON，請重試');
    }
    const tc = (s) => (0, antiSpamService_1.convertToTraditional)(s || '');
    const validStrength = (s) => s === 'strong' || s === 'medium' || s === 'weak' ? s : 'medium';
    return {
        company,
        ticker,
        region,
        business_model: tc(parsed.business_model),
        moat: (parsed.moat || []).map((m) => ({
            factor: tc(m.factor),
            strength: validStrength(m.strength),
            note: tc(m.note),
        })),
        financial_focus: (parsed.financial_focus || []).map(tc),
        bull_case: tc(parsed.bull_case),
        bear_case: tc(parsed.bear_case),
        valuation_framework: tc(parsed.valuation_framework),
        watch_indicators: (parsed.watch_indicators || []).map(tc),
        disclaimer: exports.STOCK_DISCLAIMER,
    };
}
async function generateBacktestPlan(req) {
    const strategy = req.strategy.trim();
    if (!strategy) {
        throw new Error('strategy 為必填欄位');
    }
    const market = req.market || '台股 / 美股';
    const period = req.period || '近 10 年';
    const prompt = `請以量化研究員身分，將下列策略描述轉成可執行的回測計畫。
這是教學用框架，不執行實際回測，也不保證策略有效。

策略描述：${strategy}
市場：${market}
觀察期間：${period}

請只輸出以下 JSON：
{
  "signal_definition": "60 字內，將策略轉化為明確訊號定義（哪些變數、用什麼閾值）",
  "entry_rules": ["進場規則 1（具體可程式化）", "規則 2", "規則 3"],
  "exit_rules": ["出場規則 1（停利、停損、訊號反轉）", "規則 2", "規則 3"],
  "position_sizing": "40 字內，部位大小規則（例：等權、波動度倒數、Kelly）",
  "metrics_to_track": [
    { "metric": "Sharpe Ratio", "meaning": "風險調整後報酬" },
    { "metric": "Max Drawdown", "meaning": "最大回撤" },
    { "metric": "Win Rate", "meaning": "勝率" },
    { "metric": "Profit Factor", "meaning": "獲利因子" }
  ],
  "common_biases": [
    { "bias": "回測常見偏誤名稱（例：Lookahead Bias、Survivorship Bias、Overfitting）",
      "mitigation": "如何避免" }
  ],
  "data_requirements": ["需要的資料 1（例：日線開高低收量）", "資料 2"]
}

common_biases 至少給 3 項。`;
    const raw = await callMiniMax(prompt, 4096);
    const parsed = extractJson(raw);
    if (!parsed) {
        throw new Error('AI 回應無法解析為 JSON，請重試');
    }
    const tc = (s) => (0, antiSpamService_1.convertToTraditional)(s || '');
    return {
        strategy,
        market,
        period,
        signal_definition: tc(parsed.signal_definition),
        entry_rules: (parsed.entry_rules || []).map(tc),
        exit_rules: (parsed.exit_rules || []).map(tc),
        position_sizing: tc(parsed.position_sizing),
        metrics_to_track: (parsed.metrics_to_track || []).map((m) => ({
            metric: tc(m.metric),
            meaning: tc(m.meaning),
        })),
        common_biases: (parsed.common_biases || []).map((b) => ({
            bias: tc(b.bias),
            mitigation: tc(b.mitigation),
        })),
        data_requirements: (parsed.data_requirements || []).map(tc),
        disclaimer: exports.STOCK_DISCLAIMER,
    };
}
