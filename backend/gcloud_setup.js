const { chromium } = require('playwright');

(async () => {
  // Use existing Chrome profile to reuse Google login
  const userDataDir = process.env.USERPROFILE + '/AppData/Local/Google/Chrome/User Data';
  
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: ['--no-first-run', '--no-default-browser-check'],
  });

  const page = await browser.newPage();
  
  console.log('Opening Google Cloud Console...');
  await page.goto('https://console.cloud.google.com/projectcreate', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: '/tmp/step1.png' });
  console.log('Screenshot saved: step1.png');
  
  // Wait a bit
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/step1b.png' });
  console.log('Done - check screenshots');
  
  // Keep browser open
  await page.waitForTimeout(5000);
  await browser.close();
})();
