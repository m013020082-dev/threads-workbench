"use strict";
/**
 * 技術指標本地計算（純函式，不需外部 API）
 * 使用者貼上「日期,收盤」CSV，後端計算 MA / RSI / MACD
 *
 * 注意：技術指標只是「歷史價格的數學變換」，不是預測未來。
 * 提供這些是讓使用者學習指標如何計算與解讀，不代表使用就會獲利。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePriceCSV = parsePriceCSV;
exports.computeIndicators = computeIndicators;
function parsePriceCSV(csv) {
    const lines = csv
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    if (lines.length === 0)
        return [];
    // 偵測表頭
    const first = lines[0].toLowerCase();
    const hasHeader = first.includes('date') || first.includes('日期') || first.includes('close');
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const points = [];
    for (const line of dataLines) {
        const parts = line.split(/[,\t]/).map((p) => p.trim());
        if (parts.length < 2)
            continue;
        const date = parts[0];
        const close = Number(parts[1]);
        if (!date || Number.isNaN(close))
            continue;
        points.push({ date, close });
    }
    // 確保按日期升冪
    points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return points;
}
function simpleMA(values, period) {
    const out = [];
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= period)
            sum -= values[i - period];
        out.push(i >= period - 1 ? sum / period : null);
    }
    return out;
}
function ema(values, period) {
    const out = [];
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            out.push(null);
            continue;
        }
        if (prev === null) {
            // 用前 period 個值的 SMA 當初始 EMA
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++)
                sum += values[j];
            prev = sum / period;
            out.push(prev);
        }
        else {
            prev = values[i] * k + prev * (1 - k);
            out.push(prev);
        }
    }
    return out;
}
function rsi(values, period = 14) {
    const out = [];
    if (values.length < period + 1) {
        return values.map(() => null);
    }
    let avgGain = 0;
    let avgLoss = 0;
    // 初始平均
    for (let i = 1; i <= period; i++) {
        const diff = values[i] - values[i - 1];
        if (diff >= 0)
            avgGain += diff;
        else
            avgLoss -= diff;
    }
    avgGain /= period;
    avgLoss /= period;
    for (let i = 0; i <= period; i++)
        out.push(null);
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = period + 1; i < values.length; i++) {
        const diff = values[i] - values[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
    }
    return out;
}
function macd(values, fast = 12, slow = 26, signal = 9) {
    const emaFast = ema(values, fast);
    const emaSlow = ema(values, slow);
    const macdLine = values.map((_, i) => {
        const f = emaFast[i];
        const s = emaSlow[i];
        return f !== null && s !== null ? f - s : null;
    });
    // signal line 用 macdLine 的 EMA，但只能對非 null 區段算
    const validValues = macdLine.map((v) => (v === null ? 0 : v));
    const signalRaw = ema(validValues, signal);
    // 對齊：macdLine 為 null 的位置 signal 也為 null
    const signalLine = macdLine.map((v, i) => (v === null ? null : signalRaw[i]));
    const histogram = macdLine.map((v, i) => {
        const s = signalLine[i];
        return v !== null && s !== null ? v - s : null;
    });
    return { macd_line: macdLine, signal_line: signalLine, histogram };
}
function generateObservations(result) {
    const obs = [];
    const n = result.count;
    if (n < 2)
        return ['資料不足，無法產生觀察結論'];
    const lastClose = result.closes[n - 1];
    const ma5 = result.ma.ma5[n - 1];
    const ma20 = result.ma.ma20[n - 1];
    const ma60 = result.ma.ma60[n - 1];
    const rsi = result.rsi14[n - 1];
    const histLast = result.macd.histogram[n - 1];
    const histPrev = result.macd.histogram[n - 2];
    if (ma5 !== null && ma20 !== null) {
        if (ma5 > ma20 && lastClose > ma5)
            obs.push('短期均線在中期均線之上，且收盤價在 MA5 上方 — 短線結構偏多');
        else if (ma5 < ma20 && lastClose < ma5)
            obs.push('短期均線在中期均線之下，且收盤價在 MA5 下方 — 短線結構偏空');
        else
            obs.push('均線排列與收盤價位置出現分歧 — 趨勢可能轉折或盤整');
    }
    if (ma20 !== null && ma60 !== null) {
        const prevMa20 = result.ma.ma20[n - 2];
        const prevMa60 = result.ma.ma60[n - 2];
        if (prevMa20 !== null && prevMa60 !== null) {
            if (prevMa20 <= prevMa60 && ma20 > ma60)
                obs.push('MA20 由下穿越 MA60（黃金交叉訊號），但需配合量能與大盤確認');
            if (prevMa20 >= prevMa60 && ma20 < ma60)
                obs.push('MA20 由上跌破 MA60（死亡交叉訊號），需注意中期趨勢轉弱風險');
        }
    }
    if (rsi !== null) {
        if (rsi > 70)
            obs.push(`RSI = ${rsi.toFixed(1)}，進入超買區（>70），歷史上常伴隨短線回檔但不必然下跌`);
        else if (rsi < 30)
            obs.push(`RSI = ${rsi.toFixed(1)}，進入超賣區（<30），歷史上常伴隨短線反彈但不必然上漲`);
        else
            obs.push(`RSI = ${rsi.toFixed(1)}，落在中性區間（30-70）`);
    }
    if (histLast !== null && histPrev !== null) {
        if (histPrev <= 0 && histLast > 0)
            obs.push('MACD 柱狀圖剛轉正（多頭動能訊號）');
        else if (histPrev >= 0 && histLast < 0)
            obs.push('MACD 柱狀圖剛轉負（空頭動能訊號）');
        else if (histLast > 0 && histLast > histPrev)
            obs.push('MACD 柱狀圖正值持續放大，多頭動能增強中');
        else if (histLast < 0 && histLast < histPrev)
            obs.push('MACD 柱狀圖負值持續擴大，空頭動能增強中');
    }
    obs.push('⚠️ 技術指標僅為歷史價格的數學變換，不具預測能力。任何訊號都需配合基本面、產業面、總經面與部位管理。');
    return obs;
}
function computeIndicators(points) {
    if (points.length === 0) {
        throw new Error('沒有有效的價格資料');
    }
    const closes = points.map((p) => p.close);
    const dates = points.map((p) => p.date);
    const ma5 = simpleMA(closes, 5);
    const ma20 = simpleMA(closes, 20);
    const ma60 = simpleMA(closes, 60);
    const rsi14 = rsi(closes, 14);
    const macdResult = macd(closes);
    const partial = {
        count: points.length,
        date_range: { start: dates[0], end: dates[dates.length - 1] },
        ma: { ma5, ma20, ma60 },
        rsi14,
        macd: macdResult,
        closes,
        dates,
    };
    return {
        ...partial,
        observations: generateObservations(partial),
    };
}
