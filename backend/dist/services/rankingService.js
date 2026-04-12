"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scorePost = scorePost;
exports.rankPosts = rankPosts;
const client_1 = require("../db/client");
// 台灣地區相關詞彙，用於加分
const TW_LOCATION_TERMS = ['台灣', '台北', '台中', '台南', '高雄', '新竹', '桃園', '台', 'taiwan', 'tw', '台灣人'];
function isTaiwanContent(post) {
    if (post.region === 'TW')
        return true;
    const text = post.post_text.toLowerCase();
    const location = (post.author_location || '').toLowerCase();
    return TW_LOCATION_TERMS.some(t => text.includes(t.toLowerCase()) || location.includes(t.toLowerCase()));
}
function isTraditionalChinese(text) {
    // 繁體中文常見字符範圍（CJK Unified Ideographs）
    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    return chineseCharCount > 5;
}
function scorePost(post, keywords) {
    const text = post.post_text.toLowerCase();
    const keyword_matches = keywords.filter(k => text.includes(k.toLowerCase()));
    // Keyword relevance (0-40)
    const keywordScore = Math.min(40, (keyword_matches.length / Math.max(keywords.length, 1)) * 40);
    // Engagement (0-30): likes + comments
    const engagement = post.like_count + post.comment_count * 2;
    const engagement_score = Math.min(30, Math.log10(engagement + 1) * 10);
    // Follower range bonus (0-15): 1k-100k is ideal
    const f = post.author_followers;
    let follower_score = 0;
    if (f >= 1000 && f <= 100000)
        follower_score = 15;
    else if (f >= 100 && f < 1000)
        follower_score = 8;
    else if (f > 100000)
        follower_score = 4;
    // Recency bonus (0-10)
    const ageMs = Date.now() - new Date(post.created_at).getTime();
    const ageHours = ageMs / 3600000;
    let recencyScore = 0;
    if (ageHours < 2)
        recencyScore = 10;
    else if (ageHours < 6)
        recencyScore = 7;
    else if (ageHours < 24)
        recencyScore = 4;
    // 台灣地區加分 (0-5): 確認為台灣地區內容優先
    let regionScore = 0;
    if (isTaiwanContent(post))
        regionScore += 3;
    if (isTraditionalChinese(post.post_text))
        regionScore += 2;
    const score = Math.round((keywordScore + engagement_score + follower_score + recencyScore + regionScore) * 10) / 10;
    return { score, keyword_matches, engagement_score, follower_score };
}
async function rankPosts(posts, workspaceId, searchKeywords = [], filterByKeywords = false) {
    const kwRes = await (0, client_1.query)('SELECT keyword FROM keywords WHERE workspace_id = $1 AND enabled = true', [workspaceId]);
    const workspaceKeywords = kwRes.rows.map((r) => r.keyword);
    // Merge workspace keywords + caller-supplied search keywords (dedup)
    const allKeywords = [...new Set([...workspaceKeywords, ...searchKeywords])];
    let ranked = posts.map(post => {
        const { score, keyword_matches, engagement_score, follower_score } = scorePost(post, allKeywords);
        return { post, score, keyword_matches, engagement_score, follower_score };
    });
    // When the caller has specific keywords, drop posts whose text contains none of them
    if (filterByKeywords && searchKeywords.length > 0) {
        ranked = ranked.filter(r => {
            const text = r.post.post_text.toLowerCase();
            return searchKeywords.some(sk => text.includes(sk.toLowerCase()));
        });
    }
    return ranked.sort((a, b) => b.score - a.score);
}
