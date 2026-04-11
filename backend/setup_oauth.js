const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500,
  });

  const page = await browser.newPage();

  // Step 1: Go to GitHub login
  console.log('Step 1: GitHub login...');
  await page.goto('https://github.com/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Click Continue with Google
  const googleBtn = await page.$('text=Continue with Google');
  if (googleBtn) {
    console.log('Clicking Continue with Google...');
    await googleBtn.click();
    await page.waitForTimeout(2000);
    
    // Type Google email
    await page.fill('input[type="email"]', 'm013020082@gmail.com');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'D:/computeruse/threads-workbench/backend/oauth_login.png' });
    console.log('SCREENSHOT: oauth_login.png - PLEASE TYPE YOUR GOOGLE PASSWORD IN THE BROWSER');
    
    // Wait for user to complete login (3 minutes)
    console.log('Waiting for login to complete (will timeout in 3 min)...');
    await page.waitForURL('**/github.com/**', { timeout: 180000 }).catch(() => {});
  }

  await page.screenshot({ path: 'D:/computeruse/threads-workbench/backend/oauth_after_login.png' });
  const currentUrl = page.url();
  console.log('After login URL:', currentUrl);

  // Save browser state for next script
  const cookies = await browser.contexts()[0].cookies();
  require('fs').writeFileSync('D:/computeruse/threads-workbench/backend/github_cookies.json', JSON.stringify(cookies));
  console.log('Cookies saved');

  await browser.close();
})();
