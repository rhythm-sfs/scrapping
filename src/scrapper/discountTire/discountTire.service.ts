import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randomUseragent = require('random-useragent');
import { NormalizeService } from '../../services/normalize.service';
import { TireService } from '../../tire/tire.service';

puppeteer.use(StealthPlugin());

@Injectable()
export class DiscountTireService {
  constructor(
    private readonly normalize: NormalizeService,
    private readonly tireService: TireService,
  ) {}

  async scrape(zip = '10001') {
    const proxy = process.env.SCRAPER_PROXY || '';
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ];
    if (proxy) {
      launchArgs.push(`--proxy-server=${proxy}`);
      console.log(' Using proxy:', proxy);
    }

    const browser = await puppeteer.launch({
      headless: false,
      args: launchArgs,
    });
    const context = await browser.createBrowserContext();
    await context.overridePermissions('https://www.discounttire.com', []);
    const page = await context.newPage();

    const userAgent = randomUseragent.getRandom();
    await page.setUserAgent(
      userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9',
    });

    const searchUrl = `https://www.discounttire.com/fitmentresult/tires/size/225-45-17`;
    console.log(`🔍 Visiting: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(res => setTimeout(res, 5000));

    // Try to close the store selection modal if present
    try {
      await page.waitForSelector('svg.popover__close-button-icon___1L_mw', { timeout: 5000 });
      await page.evaluate(() => {
        const svg = document.querySelector('svg.popover__close-button-icon___1L_mw');
        if (svg) {
          const button = svg.closest('button');
          if (button) button.click();
        }
      });
      console.log('Closed store selection modal.');
    } catch (e) {
      console.log('No store selection modal found or already closed.');
    }

    await this.autoScroll(page);

    // Wait for product cards (using product card container)
    try {
      await page.waitForSelector('div.product-list-card__container___3e7Ww', { timeout: 60000 });
    } catch (err) {
      const html = await page.content();
      require('fs').writeFileSync('discount_debug.html', html);
      throw err;
    }

    // Get all product card containers
    const products = await page.$$('div.product-list-card__container___3e7Ww');
    const data: any[] = [];

    for (const product of products) {
      try {
        const brand = await product.$eval('span.product-title__brand', el => el.textContent?.trim() || '');
        const model = await product.$eval('span.product-title__name', el => el.textContent?.trim() || '');
        const size = await product.$eval('span.product-title__size', el => el.textContent?.trim() || '');
        const priceRaw = await product.$eval('span.price', el => el.textContent?.trim() || '');
        const price = priceRaw.replace(/[^\d.]/g, '');

        if (!brand || !model || !price) continue;

        const normalized = this.normalize.normalize(
          { brand, model, size, price },
          'DiscountTire',
        );

        await this.tireService.saveTire({
          ...normalized,
          scrapedAt: new Date(),
        });

        data.push(normalized);
      } catch (err) {
        console.warn(` Skipped a product: ${err.message}`);
      }
    }

    console.log(`Discount Tire: Scraped ${data.length} tires`);
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
