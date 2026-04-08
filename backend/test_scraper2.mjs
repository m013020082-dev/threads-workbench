import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--lang=zh-TW'] });
  const context = await browser.newContext({
    locale: 'zh-TW',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.goto('https://www.threads.net/search?q=AI&serp_type=default', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  // scroll a few times
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.scrollBy(0, 1200)); await page.waitForTimeout(500); }

  const result = await page.evaluate(() => {
    const postLinks = Array.from(document.querySelectorAll('a[href*="/post/"]'))
      .filter(a => {
        const href = a.getAttribute('href') || '';
        return href.includes('/post/') && !href.includes('/media') && !href.includes('/activity');
      });
    
    console.log('Total post links:', postLinks.length);
    
    const results = [];
    const seen = new Set();
    
    postLinks.forEach((link) => {
      const href = link.getAttribute('href') || '';
      const fullUrl = href.startsWith('http') ? href : `https://www.threads.com${href}`;
      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);
      
      const handleMatch = href.match(/\/@([^/]+)\//);
      if (!handleMatch) { results.push({debug: 'no handle', href}); return; }
      const handle = `@${handleMatch[1]}`;
      
      let container = link.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!container) break;
        if ((container).innerText?.length > 60) break;
        container = container.parentElement;
      }
      if (!container) { results.push({debug: 'no container', handle}); return; }
      
      const rawText = container.innerText || '';
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      const textLines = lines.filter(l =>
        l.length > 15 &&
        !l.match(/^\d{4}-\d{1,2}-\d{1,2}$/) &&
        !l.match(/^[\d,.萬千kKmM]+$/) &&
        !l.startsWith('@') &&
        !l.match(/^[0-9]+$/) &&
        !l.match(/^\d+[mhdw]$/)
      );
      const postText = textLines.slice(0, 5).join(' ').trim();
      
      results.push({
        handle,
        url: fullUrl,
        containerTextLen: rawText.length,
        lineCount: lines.length,
        textLineCount: textLines.length,
        postText: postText.substring(0, 80),
        passed: postText.length >= 15
      });
    });
    return results;
  });
  
  console.log('Parsed results:', result.length);
  result.forEach((r, i) => console.log(i, JSON.stringify(r)));
  await browser.close();
}
test().catch(console.error);
