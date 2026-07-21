const { chromium } = require('playwright-core');
const path = require('node:path');

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const output = path.join(__dirname);
const routes = [
  { name: 'scopes', path: '/sdk/scopes', width: 1440, height: 1000 },
  { name: 'keys', path: '/sdk/keys', width: 1440, height: 1000 },
  { name: 'events', path: '/events', width: 1440, height: 1000 },
  { name: 'dlq', path: '/dlq', width: 1440, height: 1000 },
  { name: 'reconciliation', path: '/reconciliation', width: 1440, height: 1000 },
  { name: 'scopes-mobile', path: '/sdk/scopes', width: 390, height: 844 },
  { name: 'events-mobile', path: '/events', width: 390, height: 844 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  const failures = [];

  for (const route of routes) {
    const page = await browser.newPage({
      viewport: { width: route.width, height: route.height },
      deviceScaleFactor: 1,
    });
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    const response = await page.goto(`http://localhost:3000${route.path}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(output, `playwright-${route.name}.png`),
      fullPage: false,
    });

    const overflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
    }));

    if (!response?.ok() || consoleErrors.length || overflow.documentWidth > overflow.viewportWidth + 1) {
      failures.push({
        route: route.path,
        status: response?.status(),
        consoleErrors,
        overflow,
      });
    }
    console.log(JSON.stringify({ name: route.name, status: response?.status(), consoleErrors, overflow }));
    await page.close();
  }

  await browser.close();
  if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exitCode = 1;
  }
})();
