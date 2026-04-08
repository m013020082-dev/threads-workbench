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
  
  await page.goto('https://www.threads.net/search?q=AI&serp_type=default', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(4000);
  
  const url = page.url();
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 300));
  console.log('URL:', url);
  console.log('Title:', title);
  console.log('Body preview:', bodyText);
  
  const links = await page.$$eval('a[href*="/post/"]', els => 
    els.map(e => e.getAttribute('href')).filter(h => h && !h.includes('/media'))
  );
  console.log('Post links:', links.length);
  
  await browser.close();
}
test().catch(e => console.error('Error:', e.message));
