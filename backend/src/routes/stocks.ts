import { Router, Request, Response } from 'express';
import {
  analyzeIndustry,
  buildScreenerFramework,
  generateStockOpinion,
  generateBacktestPlan,
  STOCK_DISCLAIMER,
} from '../services/stockAnalyzerService';
import { computeIndicators, parsePriceCSV } from '../services/technicalIndicatorService';

const router = Router();

// GET /api/stocks/disclaimer
router.get('/disclaimer', (_req: Request, res: Response) => {
  res.json({ disclaimer: STOCK_DISCLAIMER });
});

// POST /api/stocks/industry-analysis
router.post('/industry-analysis', async (req: Request, res: Response) => {
  try {
    const { industry, region, horizon_years } = req.body || {};
    if (!industry || typeof industry !== 'string') {
      return res.status(400).json({ error: 'industry 為必填欄位（字串）' });
    }
    const result = await analyzeIndustry({
      industry,
      region: typeof region === 'string' ? region : undefined,
      horizon_years:
        typeof horizon_years === 'number' && horizon_years > 0 && horizon_years <= 10
          ? horizon_years
          : undefined,
    });
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stocks] industry-analysis error:', message);
    res.status(500).json({ error: message });
  }
});

// POST /api/stocks/screen
router.post('/screen', async (req: Request, res: Response) => {
  try {
    const { industry, region, market_cap, growth_profile, notes } = req.body || {};
    const result = await buildScreenerFramework({
      industry: typeof industry === 'string' ? industry : undefined,
      region: typeof region === 'string' ? region : undefined,
      market_cap:
        market_cap === 'small' || market_cap === 'mid' || market_cap === 'large' || market_cap === 'any'
          ? market_cap
          : undefined,
      growth_profile:
        growth_profile === 'high_growth' ||
        growth_profile === 'stable' ||
        growth_profile === 'turnaround' ||
        growth_profile === 'any'
          ? growth_profile
          : undefined,
      notes: typeof notes === 'string' ? notes : undefined,
    });
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stocks] screen error:', message);
    res.status(500).json({ error: message });
  }
});

// POST /api/stocks/opinion
router.post('/opinion', async (req: Request, res: Response) => {
  try {
    const { company, ticker, region } = req.body || {};
    if (!company || typeof company !== 'string') {
      return res.status(400).json({ error: 'company 為必填欄位（字串）' });
    }
    const result = await generateStockOpinion({
      company,
      ticker: typeof ticker === 'string' ? ticker : undefined,
      region: typeof region === 'string' ? region : undefined,
    });
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stocks] opinion error:', message);
    res.status(500).json({ error: message });
  }
});

// POST /api/stocks/backtest-plan
router.post('/backtest-plan', async (req: Request, res: Response) => {
  try {
    const { strategy, market, period } = req.body || {};
    if (!strategy || typeof strategy !== 'string') {
      return res.status(400).json({ error: 'strategy 為必填欄位（字串）' });
    }
    const result = await generateBacktestPlan({
      strategy,
      market: typeof market === 'string' ? market : undefined,
      period: typeof period === 'string' ? period : undefined,
    });
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stocks] backtest-plan error:', message);
    res.status(500).json({ error: message });
  }
});

// POST /api/stocks/indicators
router.post('/indicators', (req: Request, res: Response) => {
  try {
    const { csv } = req.body || {};
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'csv 為必填欄位（字串，格式：日期,收盤）' });
    }
    const points = parsePriceCSV(csv);
    if (points.length === 0) {
      return res.status(400).json({ error: '無法解析 CSV，請確認格式為「日期,收盤」每行一筆' });
    }
    if (points.length < 30) {
      return res.status(400).json({ error: `資料筆數過少（${points.length} 筆），建議至少 30 筆才能算出有意義的指標` });
    }
    const result = computeIndicators(points);
    res.json({ success: true, result, disclaimer: STOCK_DISCLAIMER });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stocks] indicators error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
