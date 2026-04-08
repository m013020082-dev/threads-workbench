import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--lang=zh-TW'] });
  const context = await browser.newContext({
    locale: 'zh-TW',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('Navigating to threads search...');
  try {
    await page.goto('https://www.threads.net/search?q=AI&serp_type=default', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    const title = await page.title();
    const url = page.url();
    console.log('Title:', title);
    console.log('URL:', url);
    
    // Count post links
    const links = await page.$$eval('a[href*="/post/"]', els => els.map(e => e.getAttribute('href')).filter(h => h && !h.includes('/media')));
    console.log('Post links found:', links.length);
    if (links.length > 0) console.log('Sample:', links.slice(0,3));
    
    // Check if login required
    const loginBtn = await page.$('text="Log in"');
    const loginBtn2 = await page.$('text="登入"');
    console.log('Login button visible:', !!(loginBtn || loginBtn2));
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  await browser.close();
}
test();
