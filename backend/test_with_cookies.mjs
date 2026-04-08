import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const storageState = JSON.parse(readFileSync('test_cookies.json', 'utf8'));

async function test() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--lang=zh-TW'] });
  const context = await browser.newContext({
    locale: 'zh-TW',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    storageState,
  });
  const page = await context.newPage();
  
  console.log('Navigating WITH cookies...');
  await page.goto('https://www.threads.net/search?q=AI&serp_type=default', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  
  const url = page.url();
  const title = await page.title();
  console.log('URL after nav:', url);
  console.log('Title:', title);
  
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.scrollBy(0, 1200)); await page.waitForTimeout(500); }
  
  const links = await page.$$eval('a[href*="/post/"]', els => 
    els.map(e => e.getAttribute('href')).filter(h => h && !h.includes('/media'))
  );
  console.log('Post links found:', links.length);
  if (links.length > 0) console.log('Sample:', links.slice(0,3));
  
  await browser.close();
}
test().catch(console.error);
