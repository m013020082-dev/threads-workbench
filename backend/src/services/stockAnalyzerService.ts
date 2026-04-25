/**
 * 產業趨勢與選股研究助手
 *
 * 重要原則：
 * - 本服務僅產出「研究框架」與「公開資訊整理」，不提供買賣建議
 * - 所有輸出皆需附上免責聲明
 * - 不保證報酬率，不指名「起漲點」
 * - 內容定位為教育性質
 */

import { convertToTraditional } from './antiSpamService';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_BASE_URL = 'https://api.minimax.chat/v1';
const MINIMAX_MODEL = 'MiniMax-M2.7-highspeed';

const SYSTEM_PROMPT_TC =
  '你必須嚴格使用繁體中文（台灣用字）回應，絕對禁止出現任何簡體字。' +
  '你是一位嚴謹的產業研究員，只整理公開資訊與分析框架，' +
  '絕不提供具體買賣建議、股價預測或保證報酬。';

export const STOCK_DISCLAIMER =
  '⚠️ 本工具產出之內容為公開資訊整理與研究框架，僅供學術與教育參考。' +
  '不構成任何投資建議、股票推薦、買賣訊號或報酬保證。' +
  '所有投資決策請自行評估、自負盈虧，必要時諮詢合格之財務顧問。';

async function callMiniMax(prompt: string, maxTokens = 4096): Promise<string> {
  if (!MINIMAX_API_KEY) {
    throw new Error('MINIMAX_API_KEY 未設定，請於 .env 中設定後重啟後端');
  }

  const res = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_TC },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as any;
  let content: string = data.choices?.[0]?.message?.content || '';
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return content;
}

function extractJson<T>(raw: string): T | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export interface IndustryAnalysisRequest {
  industry: string;
  region?: string;
  horizon_years?: number;
}

export interface IndustryAnalysisResult {
  industry: string;
  region: string;
  horizon_years: number;
  thesis: string;
  growth_drivers: string[];
  value_chain: { stage: string; description: string }[];
  key_risks: string[];
  monitoring_indicators: { indicator: string; meaning: string }[];
  example_themes: string[];
  disclaimer: string;
}

export async function analyzeIndustry(
  req: IndustryAnalysisRequest
): Promise<IndustryAnalysisResult> {
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
  const parsed = extractJson<{
    thesis: string;
    growth_drivers: string[];
    value_chain: { stage: string; description: string }[];
    key_risks: string[];
    monitoring_indicators: { indicator: string; meaning: string }[];
    example_themes: string[];
  }>(raw);

  if (!parsed) {
    throw new Error('AI 回應無法解析為 JSON，請重試或調整產業名稱');
  }

  const tc = (s: string) => convertToTraditional(s || '');

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
    disclaimer: STOCK_DISCLAIMER,
  };
}

export interface ScreenerCriteria {
  industry?: string;
  region?: string;
  market_cap?: 'small' | 'mid' | 'large' | 'any';
  growth_profile?: 'high_growth' | 'stable' | 'turnaround' | 'any';
  notes?: string;
}

export interface ScreenerCandidate {
  category: string;
  rationale: string;
  example_companies: string[];
  due_diligence_checklist: string[];
}

export interface ScreenerResult {
  criteria: ScreenerCriteria;
  framework_summary: string;
  candidates: ScreenerCandidate[];
  red_flags: string[];
  disclaimer: string;
}

export async function buildScreenerFramework(
  criteria: ScreenerCriteria
): Promise<ScreenerResult> {
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
  const parsed = extractJson<{
    framework_summary: string;
    candidates: ScreenerCandidate[];
    red_flags: string[];
  }>(raw);

  if (!parsed) {
    throw new Error('AI 回應無法解析為 JSON，請重試或調整篩選條件');
  }

  const tc = (s: string) => convertToTraditional(s || '');

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
    disclaimer: STOCK_DISCLAIMER,
  };
}
