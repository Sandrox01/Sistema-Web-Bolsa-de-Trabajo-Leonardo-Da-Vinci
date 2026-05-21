const puppeteer = require('puppeteer');

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browserPromise;
}

async function renderPdfFromHtml(html, pdfOptions = {}) {
  const browser = await getBrowser();
  const page = await (await browser).newPage();
  await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'] });
  if (page.waitForNetworkIdle) {
    try { await page.waitForNetworkIdle({ idleTime: 200 }); } catch (_) {}
  }
  try {
    if (page.evaluateHandle) {
      await page.evaluate(() => document.fonts && document.fonts.ready);
    }
  } catch (err) {
    // Ignore font readiness errors in environments without Font Loading API
  }
  const buffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:9px;color:#444;width:100%;text-align:right;padding:0 30px 10px 0;"><span class="pageNumber"></span></div>',
    margin: { top: '0.9in', bottom: '0.9in', left: '0.8in', right: '0.8in' },
    ...pdfOptions
  });
  await page.close();
  return buffer;
}

async function closeBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch (_) {}
    browserPromise = null;
  }
}

process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });
process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });
process.on('exit', async () => { await closeBrowser(); });

module.exports = {
  renderPdfFromHtml
};
