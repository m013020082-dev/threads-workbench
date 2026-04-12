"use strict";
/** 共用工具函式 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSameSite = normalizeSameSite;
/**
 * 將 cookie sameSite 值正規化為 Playwright 可接受格式
 * 統一管理，避免在 threadsAuth / cookiePublisher / executeService 三處重複定義
 */
function normalizeSameSite(val) {
    if (!val)
        return 'Lax';
    const v = val.toLowerCase();
    if (v === 'strict')
        return 'Strict';
    if (v === 'none' || v === 'no_restriction')
        return 'None';
    return 'Lax';
}
