import { AntiSpamResult } from '../types';

function similarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function checkAntiSpam(draft: string, history: string[]): AntiSpamResult {
  const warnings: string[] = [];

  // Similarity check against recent history
  let maxSimilarity = 0;
  for (const prev of history) {
    const sim = similarity(draft, prev);
    if (sim > maxSimilarity) maxSimilarity = sim;
    if (sim > 0.7) warnings.push(`Too similar to a previous comment (${Math.round(sim * 100)}% match)`);
  }

  // Keyword stuffing check
  const words = draft.toLowerCase().split(/\s+/);
  const freq: Record<string, number> = {};
  for (const w of words) { freq[w] = (freq[w] || 0) + 1; }
  const stuffed = Object.entries(freq).filter(([, c]) => c > 3).map(([w]) => w);
  if (stuffed.length > 0) warnings.push(`Possible keyword stuffing: ${stuffed.join(', ')}`);

  // Length check
  if (draft.length < 10) warnings.push('Comment is too short');
  if (draft.length > 500) warnings.push('Comment is very long');

  // Spam phrases
  const spamPhrases = ['follow me', 'check my profile', 'dm me', 'click link', 'free money'];
  for (const phrase of spamPhrases) {
    if (draft.toLowerCase().includes(phrase)) warnings.push(`Contains spam phrase: "${phrase}"`);
  }

  return {
    similarity_score: maxSimilarity,
    warnings,
    passed: warnings.length === 0,
  };
}
