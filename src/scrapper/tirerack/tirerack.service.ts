import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { NormalizeService } from '../../services/normalize.service';
import { TireService } from '../../tire/tire.service';
import { ProxyService } from '../../services/proxy.service';

@Injectable()
export class TireRackService {
  constructor(
    private normalize: NormalizeService,
    private tireService: TireService,
    // private proxyService: ProxyService,
  ) {}

  async scrape() {
    let browser;

    try {
      // const proxy = await this.proxyService.getProxy();
      // browser = await puppeteer.launch({ headless: true, args: [`--proxy-server=${proxy}`] });
      browser = await puppeteer.launch({ headless: true });

      const page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      );

      await page.setViewport({ width: 1280, height: 800 });

      // Retry logic for slow proxies
      const gotoWithRetry = async (url: string, options: any, maxAttempts = 10) => {
        let attempts = 0;
        while (attempts < maxAttempts) {
          try {
            await page.goto(url, options);
            return;
          } catch (err) {
            attempts++;
            if (attempts >= maxAttempts) throw err;
            console.warn(`Retrying page.goto due to error: ${err.message} (attempt ${attempts + 1})`);
          }
        }
      };

      await gotoWithRetry(
        'https://www.tirerack.com/tires/TireSearchResults.jsp?width=225%2F&ratio=45&diameter=17',
        {
          waitUntil: 'networkidle2',
          timeout: 60000,
        },
      );

      let hasNextPage = true;
      let pageNum = 1;
      const maxPages = 1;
      const data: any[] = [];

      while (hasNextPage && pageNum <= maxPages) {
        await page.waitForSelector('.productTile', { timeout: 60000 });
        const cards = await page.$$('.productTile');

        for (const card of cards) {
          try {
            const brand = await card
              .$eval('.brandName', el => el.textContent?.trim() || '')
              .catch(() => '');

            const model = await card
              .$eval('.modelName', el => el.textContent?.trim() || '')
              .catch(() => '');

            const price = await card
              .$eval('.pricingValue', el => el.textContent?.replace('$', '').trim() || '')
              .catch(() => '');

            // 👇 Select the <li> with 'Size:' inside .productSpecs
            const size = await card
              .$eval('.productSpecs li', el => {
                const text = el.textContent || '';
                if (text.includes('Size:')) {
                  return text.replace('Size:', '').trim();
                }
                return '';
              })
              .catch(() => '');

            // Extract product URL
            const relativeUrl = await card
              .$eval('h2 a', el => el.getAttribute('href') || '')
              .catch(() => '');
            const url = relativeUrl ? `https://www.tirerack.com${relativeUrl}` : '';

            const item = { brand, model, price, size, url };

            // Validate data
            if (!brand || !model || !price || !size) {
              console.error('Invalid tire data:', item);
              continue;
            }

            const normalized = this.normalize.normalize(item, 'TireRack');
            await this.tireService.saveTire({
              ...normalized,
              scrapedAt: new Date(normalized.scrapedAt),
            });

            data.push(normalized);
          } catch (innerErr) {
            console.error(` Error extracting one tire: ${innerErr.message}`);
          }
        }

        // Pagination logic
        const nextButton = await page.$('button#nextArrowLink');
        if (nextButton && !(await nextButton.evaluate(el => el.disabled)) && pageNum < maxPages) {
          await nextButton.click();
          await page.waitForSelector('.productTile', { timeout: 60000 });
          pageNum++;
        } else {
          hasNextPage = false;
        }
      }

      console.log(`Scraped and saved ${data.length} tires from ${pageNum} pages`);
    } catch (err) {
      console.error(`Critical scraping error: ${err.message}`);
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  }
}
