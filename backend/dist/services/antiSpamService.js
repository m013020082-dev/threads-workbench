"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAntiSpam = checkAntiSpam;
exports.detectSimplifiedChinese = detectSimplifiedChinese;
exports.convertToTraditional = convertToTraditional;
function similarity(a, b) {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...setA].filter(w => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}
function checkAntiSpam(draft, history) {
    const warnings = [];
    // Similarity check against recent history
    let maxSimilarity = 0;
    for (const prev of history) {
        const sim = similarity(draft, prev);
        if (sim > maxSimilarity)
            maxSimilarity = sim;
        if (sim > 0.7)
            warnings.push(`Too similar to a previous comment (${Math.round(sim * 100)}% match)`);
    }
    // Keyword stuffing check
    const words = draft.toLowerCase().split(/\s+/);
    const freq = {};
    for (const w of words) {
        freq[w] = (freq[w] || 0) + 1;
    }
    const stuffed = Object.entries(freq).filter(([, c]) => c > 3).map(([w]) => w);
    if (stuffed.length > 0)
        warnings.push(`Possible keyword stuffing: ${stuffed.join(', ')}`);
    // Length check
    if (draft.length < 10)
        warnings.push('Comment is too short');
    if (draft.length > 500)
        warnings.push('Comment is very long');
    // Spam phrases
    const spamPhrases = ['follow me', 'check my profile', 'dm me', 'click link', 'free money'];
    for (const phrase of spamPhrases) {
        if (draft.toLowerCase().includes(phrase))
            warnings.push(`Contains spam phrase: "${phrase}"`);
    }
    return {
        similarity_score: maxSimilarity,
        warnings,
        passed: warnings.length === 0,
    };
}
// 常見簡體字對應表（鍵=簡體，值=繁體）
const OpenCC = __importStar(require("opencc-js"));
// 使用 opencc-js 做標準簡繁轉換（s2twp = 簡體 → 台灣正體）
const _converter = OpenCC.Converter({ from: 'cn', to: 'twp' });
function detectSimplifiedChinese(text) {
    const converted = _converter(text);
    const found = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] !== converted[i] && !found.includes(text[i])) {
            found.push(text[i]);
        }
    }
    return { hasSimplified: found.length > 0, chars: found };
}
function convertToTraditional(text) {
    return _converter(text);
}
