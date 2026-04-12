"use strict";
/**
 * In-memory store — used when PostgreSQL is unavailable.
 * Data is lost on server restart. For development/demo only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.memQuery = memQuery;
exports.getTable = getTable;
const tables = {
    workspaces: [],
    keywords: [],
    posts: [],
    drafts: [],
    interactions: [],
    scheduled_jobs: [],
    scheduled_job_runs: [],
    accounts: [],
};
/** Execute a subset of SQL via the in-memory store */
function memQuery(text, params = []) {
    const t = text.trim().toLowerCase();
    // INSERT INTO table (...) VALUES (...) RETURNING *
    if (t.startsWith('insert into')) {
        return handleInsert(text, params);
    }
    // UPDATE table SET ... WHERE ... RETURNING *
    if (t.startsWith('update')) {
        return handleUpdate(text, params);
    }
    // DELETE FROM table WHERE ...
    if (t.startsWith('delete')) {
        return handleDelete(text, params);
    }
    // SELECT ...
    if (t.startsWith('select')) {
        return handleSelect(text, params);
    }
    return { rows: [] };
}
function getTableName(text) {
    const match = text.match(/(?:from|into|update)\s+(\w+)/i);
    return match ? match[1].toLowerCase() : '';
}
function handleInsert(text, params) {
    const tableName = text.match(/insert into\s+(\w+)/i)?.[1]?.toLowerCase() || '';
    if (!tables[tableName])
        tables[tableName] = [];
    // Extract column names
    const colMatch = text.match(/\(([^)]+)\)\s+values/i);
    if (!colMatch)
        return { rows: [] };
    const cols = colMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
    const row = { created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    cols.forEach((col, i) => { row[col] = params[i]; });
    // ON CONFLICT (post_url) DO NOTHING — 檢查 post_url 唯一性
    if (text.toLowerCase().includes('on conflict') && text.toLowerCase().includes('post_url')) {
        const postUrlIdx = cols.indexOf('post_url');
        if (postUrlIdx >= 0 && tables[tableName].some(r => r.post_url === params[postUrlIdx])) {
            return { rows: [] }; // duplicate, skip
        }
    }
    tables[tableName].push(row);
    return { rows: [row] };
}
function handleUpdate(text, params) {
    const tableName = text.match(/update\s+(\w+)/i)?.[1]?.toLowerCase() || '';
    if (!tables[tableName])
        return { rows: [] };
    // Find WHERE id = $N or workspace_id = $N
    const whereIdMatch = text.match(/where\s+id\s*=\s*\$(\d+)/i);
    const whereWsMatch = text.match(/where\s+workspace_id\s*=\s*\$(\d+)/i);
    const whereJobMatch = text.match(/where\s+job_id\s*=\s*\$(\d+)/i);
    const wherePostMatch = text.match(/where\s+post_id\s*=\s*\$(\d+)/i);
    let filterFn = () => true;
    if (whereIdMatch) {
        const id = params[parseInt(whereIdMatch[1]) - 1];
        filterFn = (r) => r.id === id;
    }
    else if (whereWsMatch) {
        const wsId = params[parseInt(whereWsMatch[1]) - 1];
        filterFn = (r) => r.workspace_id === wsId;
    }
    else if (whereJobMatch) {
        const jobId = params[parseInt(whereJobMatch[1]) - 1];
        filterFn = (r) => r.job_id === jobId;
    }
    else if (wherePostMatch) {
        const postId = params[parseInt(wherePostMatch[1]) - 1];
        filterFn = (r) => r.post_id === postId;
    }
    // Parse SET col = $N pairs
    const setMatch = text.match(/set\s+(.+?)\s+where/is);
    const setPairs = [];
    if (setMatch) {
        const setStr = setMatch[1];
        const pairs = setStr.split(',').map(s => s.trim());
        for (const pair of pairs) {
            const m = pair.match(/(\w+)\s*=\s*\$(\d+)/);
            if (m)
                setPairs.push({ col: m[1], paramIdx: parseInt(m[2]) - 1 });
            // Handle SET col = 'literal'
            const lit = pair.match(/(\w+)\s*=\s*'([^']*)'/);
            if (lit)
                setPairs.push({ col: lit[1], paramIdx: -1 });
        }
    }
    // Also handle inline status updates like SET status = 'DRAFTED'
    const inlineStatus = text.match(/set\s+status\s*=\s*'(\w+)'/i);
    const inlineApproved = text.match(/set\s+approved\s*=\s*(true|false)/i);
    const inlineEnabled = text.match(/set\s+enabled\s*=\s*\$(\d+)/i);
    const updated = [];
    tables[tableName] = tables[tableName].map(row => {
        if (!filterFn(row))
            return row;
        const newRow = { ...row, updated_at: new Date().toISOString() };
        for (const { col, paramIdx } of setPairs) {
            if (paramIdx >= 0)
                newRow[col] = params[paramIdx];
        }
        if (inlineStatus)
            newRow['status'] = inlineStatus[1];
        if (inlineApproved)
            newRow['approved'] = inlineApproved[1] === 'true';
        if (inlineEnabled)
            newRow['enabled'] = params[parseInt(inlineEnabled[1]) - 1];
        updated.push(newRow);
        return newRow;
    });
    return { rows: updated };
}
function handleDelete(text, params) {
    const tableName = text.match(/delete\s+from\s+(\w+)/i)?.[1]?.toLowerCase() || '';
    if (!tables[tableName])
        return { rows: [] };
    const whereIdMatch = text.match(/where\s+id\s*=\s*\$(\d+)/i);
    const whereWsId = text.match(/where\s+workspace_id\s*=\s*\$(\d+)/i);
    const whereTwoId = text.match(/where\s+id\s*=\s*\$1\s+and\s+workspace_id\s*=\s*\$2/i);
    tables[tableName] = tables[tableName].filter(row => {
        if (whereTwoId)
            return !(row.id === params[0] && row.workspace_id === params[1]);
        if (whereIdMatch)
            return row.id !== params[parseInt(whereIdMatch[1]) - 1];
        if (whereWsId)
            return row.workspace_id !== params[parseInt(whereWsId[1]) - 1];
        return false;
    });
    return { rows: [] };
}
function handleSelect(text, params) {
    const tableName = getTableName(text);
    const rows = tables[tableName] ? [...tables[tableName]] : [];
    // Simple WHERE clause handling
    let filtered = rows;
    const whereId = text.match(/where\s+(?:\w+\.)?id\s*=\s*\$(\d+)/i);
    const whereWsId = text.match(/where\s+(?:\w+\.)?workspace_id\s*=\s*\$(\d+)/i);
    const wherePostId = text.match(/where\s+post_id\s*=\s*\$(\d+)/i);
    const whereJobId = text.match(/where\s+job_id\s*=\s*\$(\d+)/i);
    const whereEnabledTrue = text.match(/enabled\s*=\s*true/i);
    const statusIn = text.match(/status\s+in\s*\(([^)]+)\)/i);
    const statusDiscovered = text.match(/status\s*=\s*'DISCOVERED'/i);
    if (whereId)
        filtered = filtered.filter(r => r.id === params[parseInt(whereId[1]) - 1]);
    if (whereWsId)
        filtered = filtered.filter(r => r.workspace_id === params[parseInt(whereWsId[1]) - 1]);
    if (wherePostId)
        filtered = filtered.filter(r => r.post_id === params[parseInt(wherePostId[1]) - 1]);
    if (whereJobId)
        filtered = filtered.filter(r => r.job_id === params[parseInt(whereJobId[1]) - 1]);
    if (whereEnabledTrue)
        filtered = filtered.filter(r => r.enabled === true);
    if (statusDiscovered)
        filtered = filtered.filter(r => r.status === 'DISCOVERED');
    if (statusIn) {
        const statuses = statusIn[1].split(',').map(s => s.trim().replace(/'/g, ''));
        filtered = filtered.filter(r => statuses.includes(r.status));
    }
    // JOIN posts + drafts for queue
    if (text.includes('json_agg') && tableName === 'posts') {
        filtered = filtered.map(post => {
            const postDrafts = (tables['drafts'] || []).filter(d => d.post_id === post.id);
            return { ...post, drafts: postDrafts.length > 0 ? postDrafts : null };
        });
    }
    // COUNT(*) stats query
    if (text.includes('count(*)') && text.includes('total_posts')) {
        const wsId = params[0];
        const wsPosts = (tables['posts'] || []).filter(r => r.workspace_id === wsId);
        return { rows: [{
                    total_posts: String(wsPosts.length),
                    posts_in_queue: String(wsPosts.filter(p => ['DRAFTED', 'APPROVED', 'READY_FOR_REVIEW'].includes(p.status)).length),
                    approved_drafts: String(wsPosts.filter(p => p.status === 'APPROVED').length),
                }] };
    }
    // SELECT 1 (health check)
    if (text.trim() === 'select 1')
        return { rows: [{ '?column?': 1 }] };
    // ORDER BY score DESC
    if (text.includes('order by') && text.includes('score desc')) {
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    if (text.includes('order by') && text.includes('created_at asc')) {
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    if (text.includes('order by') && text.includes('created_at desc')) {
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    // LIMIT
    const limitMatch = text.match(/limit\s+(\d+)/i);
    if (limitMatch)
        filtered = filtered.slice(0, parseInt(limitMatch[1]));
    return { rows: filtered };
}
function getTable(name) {
    return tables[name] || [];
}
