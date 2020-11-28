'use strict'

import Events from 'events';
import Puppeteer from 'puppeteer';
import Queue from 'queue-fifo';
import mainExtractor from './mainExtractor';

export default class Arachnid extends Events.EventEmitter {
  private domain: URL;
  private params: Array<any>;
  private maxDepth: number;
  private concurrencyNum: number;
  private followSubDomains: boolean;
  private urlsToVisitQ: Queue<Page>;
  private pagesProcessed: Map<URL, Item>;

  constructor(domain: string) {
    super();
    if (!this._isValidHttpUrl(domain)) {
      throw Error('Please enter full website URL with protocol (http or https)');
    }
    this.domain = new URL(domain);
    this.params = [];
    this.maxDepth = 1;
    this.concurrencyNum = 1;
    this.followSubDomains = false;
    this.urlsToVisitQ= new Queue();
    this.pagesProcessed = new Map();
  }

  /**
   * @method setCrawlDepth
   * @param {number} depth - set concurrency number
   */ 
  setCrawlDepth(depth: number) {
    this.maxDepth = depth;
    return this;
  }

  /**
   * @method setConcurrency 
   * @param {number} concurrencyNum - set pages to crawl depth
   */ 
  setConcurrency(concurrencyNum: number) {
    this.concurrencyNum = concurrencyNum;
    return this;
  }


  /**
   * @method setPuppeteerParameters
   * @param {Array} parameters - set list of arguments used by Puppeteer (this.args)
   */ 
  setPuppeteerParameters(parameters: Array<any>) {
    this.params = parameters;
    return this;
  }

  /**
   * @method shouldFollowSubdomains
   * @param {boolean} shouldFollow- enable or disable following links for subdomains of main domain 
   */
  shouldFollowSubdomains(shouldFollow: boolean) {
    this.followSubDomains = shouldFollow;
    return this;
  }

  _isValidHttpUrl(string: string) {
    let url;

    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }

    return url.protocol === 'https:' || url.protocol === 'http:';
  }

  async traverse() {
    this.urlsToVisitQ.enqueue({ url: this.domain, depth: 1 });
    while (!this.urlsToVisitQ.isEmpty()) {
      this.emit('info', `Getting next batch size from queue to process, current queue size ${this.urlsToVisitQ.size()}`);
      const urlsToProcess = this.getNextPageBatch();
      const pagesInfoResult = await this.processPageBatch(urlsToProcess);
      pagesInfoResult.forEach(item => this.markItemAsProcessed(item));
    }

    this.emit('results', this.pagesProcessed);
    return this.pagesProcessed;
  }

  markItemAsProcessed(item: Item) {
    this.pagesProcessed.set(item.url, item);
  }

  getNextPageBatch(): Set<Page> {
    const urlsToVisit: Set<Page> = new Set();
    let i = 0;
    while (i < this.concurrencyNum && !this.urlsToVisitQ.isEmpty()) {
      const currentPage: Page | null = this.urlsToVisitQ.dequeue();
      const normalizedCurrentLink: URL = this.getNormalizedLink(currentPage!.url);
      if (this.shouldProcessPage(normalizedCurrentLink) && !urlsToVisit.has(currentPage!)) {
        urlsToVisit.add(currentPage!);
        i++;
      }
    }
    return urlsToVisit;
  }

  shouldProcessPage(normalizedPageUrl: URL) {
    return !this.pagesProcessed.has(normalizedPageUrl);
  }

  async processPageBatch(pagesToVisit: Set<Page>){
    const browser = await Puppeteer.launch({ headless: true, args: this.params });
    const crawlPromises: any[] = [];
    pagesToVisit.forEach(page => {
      try {
        crawlPromises.push(this.crawlPage(browser, page));
      } catch (error) {
        this.emit('error', `Failed to crawl page, error:${error}`);
      }
    });

    const results: any[] = [];
    await Promise.all(crawlPromises).then(allPagesData => {
      allPagesData.forEach(data => {
        const { url, response, extractedInfo, depth } = data;
        let pageInfoResult: any = {
          url,
          isInternal: this.isInternalLink(new URL(url)),
          statusCode: response.status(),
          statusText: response.statusText(),
          contentType: response.headers()['content-type'],
          depth
        };
        if (extractedInfo) {
          pageInfoResult.linksCount = extractedInfo.links.length;
          this.addChildrenToQueue(extractedInfo, depth);
          delete extractedInfo.links;
          pageInfoResult = { ...pageInfoResult, ...extractedInfo };
        }
        results.push(pageInfoResult);
        this.emit('pageCrawlingFinished', { url: pageInfoResult.url, pageInfoResult: pageInfoResult });
      });
    }).catch(error => {
      this.emit('error', `Failed to resolve batch ${pagesToVisit}, error:${error}`);
    });

    browser.close();
    return results;
  }

  addChildrenToQueue(extractedInfo: any, depth: number) : void {
    if (depth < this.maxDepth) {
      extractedInfo.links.forEach((link: string) => {
        try {
          const extractedUrl = new URL(link);
          this.urlsToVisitQ.enqueue({ url: extractedUrl, depth: depth + 1 });
        } catch (ex) {
          this.emit("pageCrawlingSkipped", { url: link, reason: ex.toString() });
        }
      });
    }
  }

  shouldExtractInfo(currentPageUrl: URL, response: any) : boolean {
    if (response.headers()['content-type'] && !response.headers()['content-type'].includes('text/html')) {
      this.emit("pageCrawlingSkipped", { url: currentPageUrl.toString(), reason: `Content is non html (${response.headers()['content-type']})` });
      return false;
    } else if (this.followSubDomains && this.isSubDomain(currentPageUrl)) {
      return true;
    } else if (this.isSameHost(currentPageUrl)) {
      return true;
    } else {
      this.emit("pageCrawlingSkipped", { url: currentPageUrl.toString(), reason: "External Url" });
      return false;
    }
  }

  isSameHost(currentPageUrl: URL) {
    return currentPageUrl.host === this.domain.host;
  }

  isSubDomain(currentPageUrl: URL) {
    const strippedMainHost = this.domain.hostname.replace("www.", "");
    return currentPageUrl.hostname.endsWith(`.${strippedMainHost}`);
  }

  isInternalLink(currentPageUrl: URL) {
    return this.isSameHost(currentPageUrl) || this.isSubDomain(currentPageUrl);
  }

  async crawlPage(browser: any, singlePageLink: Page) {
    const page = await browser.newPage();
    this.emit('pageCrawlingStarted', { url: singlePageLink.url.toString(), depth: singlePageLink.depth });
    page.on('response', (response: any) => {
      const status = response.status()
      if ((status >= 300) && (status <= 399)) {
        const responseUrl = new URL(response.url());
        const pageUrl = this.getNormalizedLink(responseUrl);
        this.markItemAsProcessed({
          url: pageUrl,
          statusCode: status,
          statusText: response.statusText(),
          redirectUrl: response.headers()['location'],
          contentType: response.headers()['content-type'],
          isInternal: this.isInternalLink(responseUrl)
        });
      }
    });
    const response = await page.goto(this.getNormalizedLink(singlePageLink.url), { waitUntil: 'domcontentloaded', timeout: 0 });

    let extractedInfo;
    if (response.status() > 399) {
      this.emit('pageCrawlingFailed', { url: singlePageLink.url.toString(), statusCode: response.status() });
    } else {
      this.emit('pageCrawlingSuccessed', { url: singlePageLink.url.toString(), statusCode: response.status() });
      if (this.shouldExtractInfo(singlePageLink.url, response)) {
        extractedInfo = await mainExtractor(page);
      }
    }
    page.close();

    return {
      url: singlePageLink.url.toString(),
      response,
      extractedInfo,
      depth: singlePageLink.depth
    };
  }

  getNormalizedLink(currentPageUrl: URL) : URL {
    return new URL(currentPageUrl.href.replace(currentPageUrl.hash, ""));
  }
}
