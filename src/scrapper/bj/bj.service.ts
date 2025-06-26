import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { NormalizeService } from '../../services/normalize.service';
import { TireService } from '../../tire/tire.service';
import { ProxyService } from '../../services/proxy.service';

@Injectable()
export class BjService {
  constructor(
    private readonly normalize: NormalizeService,
    private readonly tireService: TireService,
    private readonly proxyService: ProxyService,
  ) {}

  async scrape(zipCode: string = '10001') {
    let browser;

    try {
      const proxy = await this.proxyService.getProxy();

      browser = await puppeteer.launch({
        headless: true,
        args: [`--proxy-server=${proxy}`],
      });

      const page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      );

      await page.setViewport({ width: 1280, height: 800 });

      const gotoWithRetry = async (url: string, options: any, maxAttempts = 5) => {
        let attempts = 0;
        while (attempts < maxAttempts) {
          try {
            await page.goto(url, options);
            return;
          } catch (err) {
            attempts++;
            if (attempts >= maxAttempts) throw err;
            console.warn(`Retrying page.goto: ${err.message} (attempt ${attempts + 1})`);
          }
        }
      };

      await gotoWithRetry('https://tires.bjs.com/', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      // Enter ZIP code
      await page.waitForSelector('#postal-code', { timeout: 20000 });
      await page.type('#postal-code', zipCode);
      await page.click('.enter-postal-code button');

      // Wait for product cards to load
      await page.waitForSelector('.product', { timeout: 60000 });
      const cards = await page.$$('.product');

      const data: any[] = [];

      for (const card of cards) {
        try {
          const title = await card
            .$eval('.product-title', el => el.textContent?.trim() || '')
            .catch(() => '');

          const price = await card
            .$eval('.price', el => el.textContent?.replace('$', '').trim() || '')
            .catch(() => '');

          const size = await card
            .$eval('.product-specs li', el => {
              const text = el.textContent || '';
              if (text.includes('Size:')) {
                return text.replace('Size:', '').trim();
              }
              return '';
            })
            .catch(() => '');

          const brand = title.split(' ')[0] || '';
          const model = title.replace(brand, '').trim();

          const item = {
            brand,
            model,
            size,
            price,
        
          };

          if (!brand || !model || !size || !price) {
            console.warn('Incomplete tire data:', item);
            continue;
          }

          const normalized = this.normalize.normalize(item, 'BJs');
          await this.tireService.saveTire({
            ...normalized,
            scrapedAt: new Date(normalized.scrapedAt),
          });

          data.push(normalized);
        } catch (innerErr) {
          console.error(`Error extracting BJ's tire: ${innerErr.message}`);
        }
      }

      console.log(` Scraped ${data.length} tires from BJ's for ZIP ${zipCode}`);
    } catch (err) {
      console.error(`BJ's Scraper failed: ${err.message}`);
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  }
}
