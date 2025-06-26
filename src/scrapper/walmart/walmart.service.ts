import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
// Use require for StealthPlugin to avoid default import issues
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import { NormalizeService } from '../../services/normalize.service';
import { TireService } from '../../tire/tire.service';
const randomUseragent = require('random-useragent');

puppeteer.use(StealthPlugin());

@Injectable()
export class WalmartService {
  constructor(
    private readonly normalize: NormalizeService,
    private readonly tireService: TireService,
  ) {}

  async scrape(zip = '10001') {
    // --- Proxy setup (replace with your working proxy) ---
    const proxy = process.env.SCRAPER_PROXY || '';
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ];
    if (proxy) {
      launchArgs.push(`--proxy-server=${proxy}`);
      console.log('🛡️ Using proxy:', proxy);
    }

    const browser = await puppeteer.launch({
      headless: false,
      args: launchArgs,
    });
    const page = await browser.newPage();

    // --- Randomize fingerprint ---
    const userAgent = randomUseragent.getRandom();
    await page.setUserAgent(userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280 + Math.floor(Math.random() * 200), height: 800 + Math.floor(Math.random() * 200) });
    await page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9',
    });

    // Remove zip code from the search URL for default location
    const searchUrl = `https://www.walmart.com/search?q=225%2F45r17+tires`;
    console.log(`🔍 Visiting: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(res => setTimeout(res, 5000)); // wait for DOM updates

    // Scroll to load more products
    await this.autoScroll(page);

    // Wait for product cards
    try {
      await page.waitForSelector('div[data-item-id]', { timeout: 60000 });
    } catch (err) {
      const html = await page.content();
      require('fs').writeFileSync('walmart_debug.html', html);
      throw err;
    }
    const items = await page.$$('div[data-item-id]');

    const data: any[] = [];

    for (const item of items) {
      try {
        const title = await item.$eval(
          'span[data-automation-id="product-title"]',
          el => el.textContent?.trim() || ''
        ).catch(() => '');

        const priceDollars = await item.$eval(
          'div[data-automation-id="product-price"] span.f2',
          el => el.textContent?.trim() || '0'
        ).catch(() => '');

        const priceCents = await item.$eval(
          'div[data-automation-id="product-price"] span.f6.f5-l',
          el => el.textContent?.trim() || '00'
        ).catch(() => '');

        const price = `${priceDollars}.${priceCents}`;

        if (!title || !price) continue;

        const brand = title.split(' ')[0] || '';
        const model = title.replace(brand, '').trim();
        const size = '225/45R17'; // Or extract from title dynamically if needed

        const normalized = this.normalize.normalize({ brand, model, size, price }, 'Walmart');
        await this.tireService.saveTire({
          ...normalized,
          scrapedAt: new Date(),
        });

        data.push(normalized);
      } catch (err) {
        console.warn(`⚠️ Skipped a product: ${err.message}`);
      }
    }

    console.log(`✅ Walmart: Scraped ${data.length} tires`);
    await browser.close();
  }

  private async autoScroll(page: any) {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 250);
      });
    });
  }
}
