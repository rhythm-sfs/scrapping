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

  // Hardcoded tire size combinations (same as TireRackService)
  private readonly widths = [225, 235];
  private readonly ratios = [40, 45];
  private readonly diameters = [17, 17.5];

  public async scrapeAllCombinations(zip = '10001') {
    const totalCombinations = this.widths.length * this.ratios.length * this.diameters.length;
    let processedCombinations = 0;
    for (const width of this.widths) {
      for (const ratio of this.ratios) {
        for (const diameter of this.diameters) {
          processedCombinations++;
          try {
            console.log(`DiscountTire: Scraping combination ${processedCombinations}/${totalCombinations} - Width: ${width}, Ratio: ${ratio}, Diameter: ${diameter}`);
            await this.scrape(zip, width, ratio, diameter);
            // Add a random delay between scrapes (3-6 seconds)
            const delay = 3000 + Math.random() * 3000;
            await new Promise(res => setTimeout(res, delay));
          } catch (error) {
            console.error(`DiscountTire: Error scraping combination ${processedCombinations}/${totalCombinations}:`, error.message);
            continue;
          }
        }
      }
    }
    console.log(`DiscountTire: Completed scraping all ${totalCombinations} combinations!`);
  }

  async scrape(zip = '10001', width?: number, ratio?: number, diameter?: number) {
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

    // Use provided width, ratio, diameter if available, otherwise default
    if (width && ratio && diameter) {
      var searchUrl = `https://www.discounttire.com/fitmentresult/tires/size/${width}-${ratio}-${diameter}`;
    } else {
      throw new Error('width, ratio, and diameter must be provided');
    }
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

        // Extract url
        const url = await product.$eval('a.product-image', el => el.getAttribute('href') || '').catch(() => '');
        // Extract image
        const image = await product.$eval('a.product-image img', el => el.getAttribute('src') || '').catch(() => '');
        // Extract item_availability
        const item_availability = await product.$eval('.product-availability-message span', el => el.textContent?.trim() || '').catch(() => '');
        // Extract style, ecoFocus, loadRange, servDesc, utqg if available (set to empty string if not found)
        // These may not be present in DiscountTire, so set as empty for now
        const style = '';
        const ecoFocus = '';
        const loadRange = '';
        const servDesc = '';
        const utqg = '';

        // Use loop variables for width, ratio, diameter, and zipcode argument
        const widthStr = width?.toString() || '';
        const ratioStr = ratio?.toString() || '';
        const diameterStr = diameter?.toString() || '';
        const zipcodeStr = zip?.toString() || '';

        const normalized = this.normalize.normalize(
          { brand, model, size, price, width: widthStr, ratio: ratioStr, diameter: diameterStr, zipcode: zipcodeStr, url, image, item_availability, style, ecoFocus, loadRange, servDesc, utqg, retailer: 'DiscountTire' },
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
