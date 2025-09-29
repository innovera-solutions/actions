const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Usage: node export-diagrams.js <diagramPageUrl> <png|svg>
(async () => {
  const [,, diagramsUrl, format] = process.argv;
  if (!diagramsUrl || !format) {
    console.error('Usage: node export-diagrams.js <diagramPageUrl> <png|svg>');
    process.exit(2);
  }

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(diagramsUrl, { waitUntil: 'networkidle2', timeout: 120000 });

  // Wait until Structurizr scripting API is ready
  await page.waitForFunction(() =>
    window.structurizr && structurizr.scripting && structurizr.scripting.getViews, { timeout: 60000 });

  const views = await page.evaluate(() => structurizr.scripting.getViews());
  for (const v of views) {
    await page.evaluate((key) => structurizr.scripting.changeView(key), v.key);
    await page.waitForFunction(() =>
      structurizr.scripting.isDiagramRendered && structurizr.scripting.isDiagramRendered(), { timeout: 60000 });

    if (format === 'svg') {
      const svg = await page.evaluate(() => structurizr.scripting.exportCurrentDiagramToSVG({}));
      fs.writeFileSync(path.join(process.cwd(), `${v.key}.svg`), svg, 'utf8');
    } else {
      const dataUri = await page.evaluate(() => new Promise(res => {
        structurizr.scripting.exportCurrentDiagramToPNG({}, (png) => res(png));
      }));
      const b64 = dataUri.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(process.cwd(), `${v.key}.png`), Buffer.from(b64, 'base64'));
    }

    console.log(`Exported ${v.key} as ${format}`);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });