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
  // Add width, ratio, diameter arrays (same as DiscountTire for now)
  private readonly widths = [225, 235];
  private readonly ratios = [40, 45];
  private readonly diameters = [17, 17.5];

  constructor(
    private readonly normalize: NormalizeService,
    private readonly tireService: TireService,
  ) {}

  // Scrape all combinations
  public async scrapeAllCombinations(zip = '10001') {
    const totalCombinations = this.widths.length * this.ratios.length * this.diameters.length;
    let processedCombinations = 0;
    for (const width of this.widths) {
      for (const ratio of this.ratios) {
        for (const diameter of this.diameters) {
          processedCombinations++;
          try {
            console.log(`Walmart: Scraping combination ${processedCombinations}/${totalCombinations} - Width: ${width}, Ratio: ${ratio}, Diameter: ${diameter}`);
            await this.scrape(zip, width, ratio, diameter);
            // Add a random delay between scrapes (3-6 seconds)
            const delay = 3000 + Math.random() * 3000;
            await new Promise(res => setTimeout(res, delay));
          } catch (error) {
            console.error(`Walmart: Error scraping combination ${processedCombinations}/${totalCombinations}:`, error.message);
            continue;
          }
        }
      }
    }
    console.log(`Walmart: Completed scraping all ${totalCombinations} combinations!`);
  }

  // Update scrape to accept width, ratio, diameter
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
    const page = await browser.newPage();

    // --- Randomize fingerprint ---
    const userAgent = randomUseragent.getRandom();
    await page.setUserAgent(userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280 + Math.floor(Math.random() * 200), height: 800 + Math.floor(Math.random() * 200) });
    await page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9',
    });

    // Build Walmart search URL dynamically
    if (!width || !ratio || !diameter) {
      throw new Error('width, ratio, and diameter must be provided');
    }
    const searchUrl = `https://www.walmart.com/search?q=${width}%2F${ratio}r${diameter}+tires`;
    console.log(` Visiting: ${searchUrl}`);
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
        // Extract title
        const title = await item.$eval(
          'span[data-automation-id="product-title"]',
          el => el.textContent?.trim() || ''
        ).catch(() => '');

        // Extract price
        const priceDollars = await item.$eval(
          'div[data-automation-id="product-price"] span.f2',
          el => el.textContent?.trim() || '0'
        ).catch(() => '');
        const priceCents = await item.$eval(
          'div[data-automation-id="product-price"] span.f6.f5-l',
          el => el.textContent?.trim() || '00'
        ).catch(() => '');
        const price = `${priceDollars}.${priceCents}`;

        // Extract product URL
        const url = await item.$eval(
          'a.w-100.h-100.z-1',
          el => el.getAttribute('href') || ''
        ).catch(() => '');
        const fullUrl = url ? `https://www.walmart.com${url}` : '';

        // Extract image
        const image = await item.$eval(
          'img',
          el => el.getAttribute('src') || ''
        ).catch(() => '');

        // Extract item_availability (if available)
        const item_availability = await item.$eval(
          '.prod-ProductOffer-oosMsg',
          el => el.textContent?.trim() || ''
        ).catch(() => '');

        // Parse brand, model, size, loadRange from title
        let brand = '', model = '', size = '', loadRange = '', style = '', ecoFocus = '', servDesc = '', utqg = '';
        if (title) {
          // List of known brands
          const knownBrands = [
            'Continental', 'Pirelli', 'Bridgestone', 'Kumho', 'Nexen', 'Goodyear', 'Yokohama', 'Hankook', 'Michelin',
            'Falken', 'Cooper', 'General', 'GT Radial', 'Nokian', 'Kenda', 'Firestone', 'Dunlop', 'Sailun', 'Lexani', 'Sumitomo', 'Fullway'
          ];
          // Find size
          const sizeMatch = title.match(/\d{3}\/\d{2,3}[A-Z]*R\d{2}(?:\.\d)?/i);
          size = sizeMatch ? sizeMatch[0] : `${width}/${ratio}R${diameter}`;

          // Find brand (first occurrence in title)
          let brandIndex = -1, matchedBrand = '';
          for (const b of knownBrands) {
            const idx = title.toLowerCase().indexOf(b.toLowerCase());
            if (idx !== -1 && (brandIndex === -1 || idx < brandIndex)) {
              brandIndex = idx;
              matchedBrand = b;
            }
          }
          brand = matchedBrand || title.split(' ')[0];

          // Model: everything between brand and size
          if (brandIndex !== -1 && sizeMatch) {
            const modelStart = brandIndex + brand.length;
            const modelEnd = title.toLowerCase().indexOf(size.toLowerCase());
            if (modelEnd > modelStart) {
              model = title.substring(modelStart, modelEnd).trim();
            } else {
              model = title.replace(brand, '').replace(size, '').trim();
            }
          } else {
            model = title.replace(brand, '').replace(size, '').trim();
          }

          // LoadRange: XL, SL, C, D, E, F, RF
          const loadMatch = title.match(/\b(XL|SL|C|D|E|F|RF)\b/i);
          loadRange = loadMatch ? loadMatch[1] : '';
        }

        // Use loop variables for width, ratio, diameter, and zipcode argument
        const widthStr = width?.toString() || '';
        const ratioStr = ratio?.toString() || '';
        const diameterStr = diameter?.toString() || '';
        const zipcodeStr = zip?.toString() || '';

        const normalized = this.normalize.normalize(
          { brand, model, size, price, width: widthStr, ratio: ratioStr, diameter: diameterStr, zipcode: zipcodeStr, url: fullUrl, image, item_availability, style, ecoFocus, loadRange, servDesc, utqg, retailer: 'Walmart' },
          'Walmart',
        );

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
