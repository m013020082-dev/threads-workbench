import { Router, Request, Response } from 'express';
import {
  analyzeIndustry,
  buildScreenerFramework,
  STOCK_DISCLAIMER,
} from '../services/stockAnalyzerService';

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

export default router;
