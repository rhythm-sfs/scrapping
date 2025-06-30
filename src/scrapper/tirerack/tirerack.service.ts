import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
const StealthPlugin = require('puppeteer-extra-plugin-stealth')();
import { NormalizeService } from '../../services/normalize.service';
import { TireService } from '../../tire/tire.service';

// import { ProxyService } from '../../services/proxy.service';
const randomUseragent = require('random-useragent');

puppeteer.use(StealthPlugin);

@Injectable()
export class TireRackService {
  private readonly MAX_RETRIES = 2;
  private readonly PAGE_TIMEOUT = 120000; // 2 minutes
  private readonly NAVIGATION_TIMEOUT = 90000; // 90 seconds

  // Hardcoded tire size combinations as per prompt
  private readonly widths = [225, 235];
  private readonly ratios = [40, 45];
  private readonly diameters = [ 17, 17.5];

  constructor(
    private normalize: NormalizeService,
    private tireService: TireService,
    // private proxyService: ProxyService,
  ) {}

  public async scrapeAllCombinations(zip = '10001') {
    console.log('Beginning to scrape all tire size combinations...');
    let totalCombinations = this.widths.length * this.ratios.length * this.diameters.length;
    let processedCombinations = 0;
    
    for (const width of this.widths) {
      for (const ratio of this.ratios) {
        for (const diameter of this.diameters) {
          processedCombinations++;
          try {
            console.log(`Processing combination ${processedCombinations}/${totalCombinations}`);
            console.log(`Scraping - Width: ${width}, Ratio: ${ratio}, Diameter: ${diameter}`);
            
            const result = await this.scrape({
              width: width.toString(),
              ratio: ratio.toString(),
              diameter: diameter.toString(),
              zipcode: zip,
              page: 1,
              numberOfPages: 1
            } as any);

            console.log(`Successfully scraped ${result.length} tires for combination ${processedCombinations}/${totalCombinations}`);

            // Add a random delay between scrapes (5-10 seconds)
            const delay = 5000 + Math.random() * 5000;
            console.log(`Waiting ${Math.round(delay/1000)} seconds before next scrape...`);
            await this.delay(delay);

          } catch (error) {
            console.error(`Error scraping combination ${processedCombinations}/${totalCombinations}:`, error.message);
            // Continue with next combination even if one fails
            continue;
          }
        }
      }
    }
    
    console.log(`Completed scraping all ${totalCombinations} tire size combinations!`);
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async setupPage(browser: any) {
    const page = await browser.newPage();
    
    // Set a random user agent
    const userAgent = randomUseragent.getRandom();
    await page.setUserAgent(userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    // Set a random viewport size
    await page.setViewport({ 
      width: 1280 + Math.floor(Math.random() * 100), 
      height: 800 + Math.floor(Math.random() * 100),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    });

    // Set default timeouts
    await page.setDefaultTimeout(this.PAGE_TIMEOUT);
    await page.setDefaultNavigationTimeout(this.NAVIGATION_TIMEOUT);

    // Add additional headers to appear more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'Cache-Control': 'max-age=0'
    });

    // Add common browser features
    await page.evaluateOnNewDocument(() => {
      // Overwrite the 'navigator.webdriver' property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Add chrome object to window
      Object.defineProperty(window, 'chrome', {
        value: {
          runtime: {}
        }
      });
    });

    return page;
  }

  private async autoScroll(page: any) {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100 + Math.random() * 150); // Random delay between scrolls
      });
    });
  }

  private async scrapePage(page: any, zipcode: string, width: string, ratio: string, diameter: string): Promise<any[]> {
    // Add a random delay (1-2 seconds)
    await this.delay(1000 + Math.random() * 1000);

    const cards = await page.$$('.productTile');
    const data: any[] = [];

    for (const card of cards) {
      try {
        // Add small random delays between processing each card (0.5-1.5 seconds)
        await this.delay(500 + Math.random() * 1000);

        const brand = await card.$eval('.brandName', el => el.textContent?.trim() || '');
        const model = await card.$eval('.modelName', el => el.textContent?.trim() || '');
        const price = await card.$eval('.pricingValue', el => el.textContent?.replace('$', '').trim() || '');
        const sizeText = await card.$eval('.productSpecs li', el => el.textContent?.trim() || '');

        const specs = await card.$$eval('.productSpecs li', els => {
          const getSpec = (label) => {
            const el = els.find(li => li.textContent && li.textContent.includes(label));
            if (!el) return '';
            const sbold = el.querySelector('sbold');
            return sbold?.textContent?.trim() || el.textContent?.replace(label, '')?.trim() || '';
          };
          return {
            style: getSpec('Style:'),
            ecoFocus: getSpec('Eco Focus:'),
            loadRange: getSpec('Load Range:'),
            servDesc: getSpec('Serv. Desc:'),
            utqg: getSpec('UTQG:'),
          };
        });
       
        const item_availability = await card
          .$eval('.stockingHeader', el => el.textContent?.trim() || '')
          .catch(() => '');
        const image = await card
          .$eval('.halfProductImage img', el => el.getAttribute('src') || '')
          .catch(() => '');
        const relativeUrl = await card
          .$eval('h2 a', el => el.getAttribute('href') || '')
          .catch(() => '');
        const fullUrl = relativeUrl ? `https://www.tirerack.com${relativeUrl}` : '';

        const item = {
          brand,
          model,
          price,
          size: sizeText.replace('Size:', '').trim(),
          style: specs.style,
          ecoFocus: specs.ecoFocus,
          loadRange: specs.loadRange,
          servDesc: specs.servDesc,
          utqg: specs.utqg,
          zipcode,
          url: fullUrl,
          image,
          item_availability,
          scrapedAt: new Date(),
          retailer: 'TireRack',
        };

        const normalized = this.normalize.normalize(item, 'TireRack');
        normalized.width = width;
        normalized.ratio = ratio;
        normalized.diameter = diameter;

        await this.tireService.saveTire({
          ...normalized,
          zipcode,
          item_availability: normalized.item_availability,
          scrapedAt: new Date(normalized.scrapedAt),
        });

        data.push(normalized);
      } catch (err) {
        console.error(`Error parsing card: ${err.message}`);
      }
    }

    return data;
  }

  private async getTotalPages(page: any): Promise<number> {
    try {
      const lastPageElement = await page.$('#lastPageDisplay a');
      if (lastPageElement) {
        const lastPageText = await lastPageElement.evaluate(el => el.textContent);
        return parseInt(lastPageText, 10);
      }
      
      // If no last page element, count the page numbers
      const pageNumbers = await page.$$('#pageNumbers .pagecount');
      return pageNumbers.length;
    } catch (err) {
      console.error('Error getting total pages:', err.message);
      return 1;
    }
  }

  private async getCurrentPage(page: any): Promise<number> {
    try {
      const currentPageElement = await page.$('.pagecount.currentPage');
      if (currentPageElement) {
        const currentPageText = await currentPageElement.evaluate(el => el.getAttribute('aria-label'));
        const match = currentPageText.match(/Page (\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
      return 1;
    } catch (err) {
      console.error('Error getting current page:', err.message);
      return 1;
    }
  }

  private async goToPage(page: any, targetPage: number): Promise<boolean> {
    try {
      // First check if we're already on the target page
      const currentPage = await this.getCurrentPage(page);
      if (currentPage === targetPage) {
        return true;
      }

      // Try to find the direct page link
      const pageLink = await page.$(`#pageNum_${targetPage} a`);
      if (pageLink) {
        await pageLink.click();
      } else {
        // If direct link not found (might be hidden behind ...), use next/previous
        const totalPages = await this.getTotalPages(page);
        if (targetPage > totalPages) {
          console.log(`Target page ${targetPage} exceeds total pages ${totalPages}`);
          return false;
        }

        while (await this.getCurrentPage(page) < targetPage) {
          const success = await this.goToNextPage(page);
          if (!success) return false;
        }
      }

      await page.waitForNavigation({ 
        waitUntil: ['networkidle2', 'domcontentloaded'],
        timeout: this.NAVIGATION_TIMEOUT 
      });

      // Add a random delay after navigation (2-4 seconds)
      await this.delay(2000 + Math.random() * 2000);

      // Verify we're on the correct page
      const newCurrentPage = await this.getCurrentPage(page);
      return newCurrentPage === targetPage;
    } catch (err) {
      console.error(`Error navigating to page ${targetPage}:`, err.message);
      return false;
    }
  }

  private async hasNextPage(page: any): Promise<boolean> {
    try {
      const currentPage = await this.getCurrentPage(page);
      const totalPages = await this.getTotalPages(page);
      const nextButton = await page.$('#nextArrowLink.pagination_next');
      
      return nextButton !== null && !await nextButton.evaluate(el => el.classList.contains('hide')) && currentPage < totalPages;
    } catch (err) {
      console.error('Error checking for next page:', err.message);
      return false;
    }
  }

  private async goToNextPage(page: any): Promise<boolean> {
    try {
      const nextButton = await page.$('#nextArrowLink.pagination_next');
      if (nextButton && !await nextButton.evaluate(el => el.classList.contains('hide'))) {
        const currentPage = await this.getCurrentPage(page);
        
        await nextButton.click();
        await page.waitForNavigation({ 
          waitUntil: ['networkidle2', 'domcontentloaded'],
          timeout: this.NAVIGATION_TIMEOUT 
        });
        
        // Add a random delay after navigation (2-4 seconds)
        await this.delay(2000 + Math.random() * 2000);
        
        // Verify we're on a new page
        const newCurrentPage = await this.getCurrentPage(page);
        if (newCurrentPage <= currentPage) {
          console.error('Failed to navigate to next page');
          return false;
        }
        
        // Wait for product tiles to load
        await page.waitForSelector('.productTile', { 
          timeout: this.PAGE_TIMEOUT,
          visible: true 
        });
        
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error navigating to next page:', err.message);
      return false;
    }
  }

  async scrape(frontendInput: any): Promise<any[]> {
    let browser;
    let retryCount = 0;
    const allData: any[] = [];

    while (retryCount < this.MAX_RETRIES) {
      try {
        const launchArgs = [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ];
        
        browser = await puppeteer.launch({ 
          headless: false,
          args: launchArgs,
          defaultViewport: null
        });

        const page = await this.setupPage(browser);
        const { width, ratio, diameter, zipcode } = frontendInput;
        
        // Add a random delay before navigation (2-4 seconds)
        await this.delay(2000 + Math.random() * 1000);

        // Navigate to initial URL (first page only)
        const baseUrl = `https://www.tirerack.com/tires/TireSearchResults.jsp?zip-code=${zipcode}&width=${width}/&ratio=${ratio}&diameter=${diameter}`;
        
        await page.goto(baseUrl, { 
          waitUntil: ['networkidle2', 'domcontentloaded'],
          timeout: this.NAVIGATION_TIMEOUT 
        });

        // Scroll the page to simulate human behavior
        await this.autoScroll(page);

        // Scrape only the first page
        const pageData = await this.scrapePage(page, zipcode, width, ratio, diameter);
        allData.push(...pageData);

        if (allData.length > 0) {
          console.log(`Successfully scraped and saved ${allData.length} tires from TireRack (first page only)`);
          return allData;
        } else {
          throw new Error('No tire data found on the page');
        }

      } catch (err) {
        retryCount++;
        console.error(`Scraping attempt ${retryCount} failed:`, err.message);
        
        if (browser) {
          await browser.close();
          browser = null;
        }

        if (retryCount < this.MAX_RETRIES) {
          const waitTime = 5000 * retryCount;
          console.log(`Retrying in ${waitTime/1000} seconds... (Attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
          await this.delay(waitTime);
        } else {
          console.error('Max retries reached. Scraping failed.');
          throw new Error(`Failed to scrape TireRack after ${this.MAX_RETRIES} attempts: ${err.message}`);
        }
      } finally {
        if (browser) await browser.close();
      }
    }
    return allData;
  }
}
