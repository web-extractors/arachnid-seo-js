import { EventEmitter } from 'events';
import Puppeteer, { Browser, Response } from 'puppeteer';
import Queue from 'queue-fifo';
import { URL } from 'url';

import { extractor as mainExtractor } from './mainExtractor';
import RobotsChecker from './RobotsChecker';

export default class Arachnid extends EventEmitter {
  private domain: URL;
  private params: string[];
  private maxDepth?: number;
  private maxResultsNum?: number;
  private concurrencyNum: number;
  private urlsToVisitQ: Queue<unknown>;
  private pagesProcessed: Map<string, any>;
  private followSubDomains: boolean;
  private robotsIsIgnored: boolean;
  private robotsChecker: RobotsChecker | undefined;

  constructor(domain: any) {
    super();
    if (!this._isValidHttpUrl(domain)) {
      throw Error('Please enter full website URL with protocol (http or https)');
    }
    this.domain = new URL(domain);
    this.params = [];
    this.concurrencyNum = 5;
    this.urlsToVisitQ = new Queue();
    this.pagesProcessed = new Map();
    this.followSubDomains = false;
    this.robotsIsIgnored = false;
  }

  /**
   * @method setCrawlDepth
   * @description set depth of links to crawl (based on BFS algorithm)
   * @param {number} depth - depth value
   */
  public setCrawlDepth(depth: number) {
    this.maxDepth = depth;
    return this;
  }
  
  /**
   * @method setMaxResultsNum
   * @description set maximum links count to be traversed/returned
   * @param {number} maxResultsNum - maximum results number
   */
  public setMaxResultsNum(maxResultsNum: number) {
    this.maxResultsNum = maxResultsNum;
    return this;
  }
  
  /**
   * @method setConcurrency
   * @description set number of urls to crawl concurrenctly at same time
   * @param {number} concurrencyNum - concurrency number
   */
  public setConcurrency(concurrencyNum: number) {
    this.concurrencyNum = concurrencyNum;
    return this;
  }

  /**
   * @method setPuppeteerParameters
   * @description set list of arguments used by Puppeteer browser instance
   * @param {Array} parameters - puppeteer arguments array
   */
  public setPuppeteerParameters(parameters: string[]) {
    this.params = parameters;
    return this;
  }

  /**
   * @method ignoreRobots
   * @description ignore allow/disallow rules written in robots.txt (robots.txt support enabled by default)
   */
  public ignoreRobots() {
    this.robotsIsIgnored = true;
    return this;
  }
  /**
   * @method shouldFollowSubdomains
   * @description enable or disable following links for subdomains of main domain
   * @param {boolean} shouldFollow
   */
  public shouldFollowSubdomains(shouldFollow: boolean) {
    this.followSubDomains = shouldFollow;
    return this;
  }

  private _isValidHttpUrl(urlString: string) {
    let url;
    try {
      url = new URL(urlString);
    } catch (_) {
      return false;
    }
    return url.protocol === 'https:' || url.protocol === 'http:';
  }

  public async traverse() {
    this.robotsChecker = new RobotsChecker(this.params);
    if (typeof this.maxDepth == 'undefined' && typeof this.maxResultsNum == 'undefined') {
      this.maxDepth = 1;
    }
    this.urlsToVisitQ.enqueue({ url: this.domain, depth: 1 });
    queueLoop: while (!this.urlsToVisitQ.isEmpty()) {
      this.emit(
        'info',
        `Getting next batch size from queue to process, current queue size ${this.urlsToVisitQ.size()}`,
      );
      const urlsToProcess = this.getNextPageBatch();
      const pagesInfoResults = await this.processPageBatch(urlsToProcess);
      for (let i = 0; i < pagesInfoResults.length; i++) {
        const item = pagesInfoResults[i];
        this.markItemAsProcessed(item);
        if (this.isExceedingMaxResults()) {
          this.emit('info', `Max results number of ${this.maxResultsNum} has been processed, stopping the traverse`);
          break queueLoop;
        }
      }
    }
    this.emit('results', this.pagesProcessed);
    return this.pagesProcessed;
  }

  private markItemAsProcessed(item: any) {
    if (!this.isExceedingMaxResults()) {
      this.pagesProcessed.set(item.url, item);
      this.emit('pageCrawlingFinished', { url: item.url, pageInfoResult: item });
    }
  }

  private getNextPageBatch(): Set<any> {
    const urlsToVisit = new Set();
    let i = 0;
    while (i < this.concurrencyNum && !this.urlsToVisitQ.isEmpty()) {
      const currentPage = this.urlsToVisitQ.dequeue();
      const normalizedCurrentLink = this.getNormalizedLink(currentPage.url);
      if (this.shouldProcessPage(normalizedCurrentLink) && !urlsToVisit.has(normalizedCurrentLink)) {
        urlsToVisit.add(currentPage);
        i++;
      }
    }
    return urlsToVisit;
  }

  private shouldProcessPage(normalizedPageUrl: string): boolean {
    return !this.pagesProcessed.has(normalizedPageUrl);
  }

  private async processPageBatch(pagesToVisit: any): Promise<any[]> {
    const browser = await Puppeteer.launch({ headless: true, args: this.params });
    const crawlPromises: any = [];
    pagesToVisit.forEach((page: any) => {
      try {
        crawlPromises.push(this.crawlPage(browser, page));
      } catch (error) {
        this.emit('error', `Failed to crawl page, error:${error}`);
      }
    });
    const results: any = [];
    await Promise.all(crawlPromises)
      .then((allPagesData) => {
        allPagesData.forEach((data) => {
          // @ts-expect-error ts-migrate(2339) FIXME: Property 'url' does not exist on type 'unknown'.
          const { url, response, extractedInfo, depth } = data;
          let pageInfoResult = {
            url,
            isInternal: response.status() != 0 ? this.isInternalLink(new URL(url)) : false,
            ...this.getPageInfoResponse(response),
            depth,
          };
          if (extractedInfo) {
            (pageInfoResult as any).linksCount = extractedInfo.links.length;
            this.addChildrenToQueue(extractedInfo, depth);
            delete extractedInfo.links;
            pageInfoResult = { ...pageInfoResult, ...extractedInfo };
          }
          const indexableInfo = this.extractIndexability(pageInfoResult);
          (pageInfoResult as any).indexability = indexableInfo.isIndexable;
          (pageInfoResult as any).indexabilityStatus = indexableInfo.indexabilityStatus;
          results.push(pageInfoResult);
        });
      })
      .catch((error) => {
        const urlsAsTxt = [...pagesToVisit].map((item) => item.url.href).join(', ');
        this.emit('error', `Failed to resolve batch ${urlsAsTxt}, error:${error}`);
      });
    browser.close();
    return results;
  }

  private addChildrenToQueue(extractedInfo: any, depth: number) {
    const depthInLimit = typeof this.maxDepth == 'undefined' || depth < this.maxDepth;
    let i = 0;
    while (depthInLimit && i < extractedInfo.links.length) {
      const urlString = extractedInfo.links[i++];
      if (this.pagesProcessed.has(urlString)) {
        continue;
      }
      const resultsNumInLimit =
        typeof this.maxResultsNum == 'undefined' ||
        this.pagesProcessed.size + this.urlsToVisitQ.size() < this.maxResultsNum;
      if (!resultsNumInLimit) {
        break;
      }
      try {
        const url = new URL(urlString);
        this.urlsToVisitQ.enqueue({ url: url, depth: depth + 1 });
      } catch (ex) {
        this.emit('pageCrawlingSkipped', { url: urlString, reason: ex.toString() });
        const invalidURLResults = {
          url: urlString,
          isInternal: false,
          statusCode: 0,
          statusText: 'Invalid URL',
          indexability: false,
          indexabilityStatus: 'Invalid URL',
          depth: depth + 1,
        };
        this.markItemAsProcessed(invalidURLResults);
      }
    }
  }

  private shouldExtractInfo(currentPageUrl: URL, response: Response): boolean {
    if (response.headers()['content-type'] && !response.headers()['content-type'].includes('text/html')) {
      this.emit('pageCrawlingSkipped', {
        url: currentPageUrl.toString(),
        reason: `Content is non html (${response.headers()['content-type']})`,
      });
      return false;
    } else if (this.followSubDomains && this.isSubDomain(currentPageUrl)) {
      return true;
    } else if (this.isSameHost(currentPageUrl)) {
      return true;
    } else {
      this.emit('pageCrawlingSkipped', { url: currentPageUrl.toString(), reason: 'External Url' });
      return false;
    }
  }

  private isSameHost(currentPageUrl: Url): boolean {
    return currentPageUrl.host === this.domain.host;
  }

  private isSubDomain(currentPageUrl: URL): boolean {
    const strippedMainHost = this.domain.hostname.replace('www.', '');
    return currentPageUrl.hostname.endsWith(`.${strippedMainHost}`);
  }

  private isInternalLink(currentPageUrl: URL): boolean {
    return this.isSameHost(currentPageUrl) || this.isSubDomain(currentPageUrl);
  }

  private extractIndexability(pageInfoResult: any): any {
    let isIndexable = true;
    let indexabilityStatus = '';
    if (pageInfoResult.robotsHeader && pageInfoResult.robotsHeader.includes('noindex')) {
      isIndexable = false;
      indexabilityStatus = 'noindex';
    } else if (pageInfoResult.meta && pageInfoResult.meta.robots && pageInfoResult.meta.robots.includes('noindex')) {
      isIndexable = false;
      indexabilityStatus = 'noindex';
    } else if (pageInfoResult.statusCode == 0) {
      isIndexable = false;
      indexabilityStatus = pageInfoResult.statusText;
    } else if (pageInfoResult.statusCode >= 400) {
      isIndexable = false;
      indexabilityStatus = 'Client Error';
    } else if (
      pageInfoResult.canonicalUrl &&
      decodeURI(pageInfoResult.canonicalUrl).toLowerCase() !== decodeURI(pageInfoResult.url).toLowerCase()
    ) {
      isIndexable = false;
      indexabilityStatus = 'Canonicalised';
    }
    return { isIndexable, indexabilityStatus };
  }

  private async crawlPage(browser: Browser, singlePageLink: any): Promise<any> {
    const singlePageUrl = singlePageLink.url.toString();
    const userAgent = await browser.userAgent();
    const isAllowedByRobotsTxt = await this.isAllowedByRobotsTxt(singlePageUrl, userAgent);
    if (!isAllowedByRobotsTxt) {
      this.emit('info', `${singlePageUrl} is blocked by robots.txt`);
      return this.getRobotsBlockedResult(singlePageUrl, singlePageLink.depth);
    }
    const page = await browser.newPage();
    const redirectChain = [singlePageUrl];
    page.on('response', async (response: any) => {
      if ([301, 302].includes(response.status()) && redirectChain.includes(response.url())) {
        redirectChain.push(response.headers()['location']);
        const isAllowedByRobotsTxt = await this.isAllowedByRobotsTxt(response.url(), userAgent);
        if (!isAllowedByRobotsTxt) {
          this.markItemAsProcessed(this.getRobotsBlockedResult(response.url(), singlePageLink.depth));
        } else {
          this.markResponseAsVisited(response, singlePageLink.depth);
        }
      }
    });
    this.emit('pageCrawlingStarted', { url: singlePageUrl, depth: singlePageLink.depth });
    const response: Response = await page
      .goto(this.getNormalizedLink(singlePageLink.url), { waitUntil: 'domcontentloaded', timeout: 0 })
      .catch((error: any) => {
        if (error.stack.includes('ERR_NAME_NOT_RESOLVED')) {
          return this.getErrorResponse(singlePageUrl, 'Invalid Domain name, cannot be resolved');
        } else if (error.stack.includes('ERR_CONNECTION_REFUSED')) {
          return this.getErrorResponse(singlePageUrl, 'Connection refused');
        } else {
          return this.getErrorResponse(singlePageUrl, 'Unknown error');
        }
      });
    let extractedInfo;
    if (response.status() > 399 || response.status() === 0) {
      this.emit('pageCrawlingFailed', { url: singlePageUrl, statusCode: response.status() });
    } else {
      this.emit('pageCrawlingSuccessed', { url: singlePageUrl, statusCode: response.status() });
      if (this.shouldExtractInfo(singlePageLink.url, response)) {
        try {
          extractedInfo = await mainExtractor(page);
        } catch (ex) {
          this.emit('error', `cannot extract info for ${singlePageUrl}, reason: ${JSON.stringify(ex)}`);
        }
      }
    }
    await page.close().catch((e: any) => {
      if (e.message.includes('Connection closed')) {
        return 0; // Either invalid request or a race condition
      }
    });
    return {
      url: response.url(),
      response,
      extractedInfo,
      depth: singlePageLink.depth,
    };
  }

  private markResponseAsVisited(response: Response, depth: number) {
    const responseUrl = new URL(response.url());
    const pageUrl = this.getNormalizedLink(responseUrl);
    if (!this.pagesProcessed.has(pageUrl)) {
      const resultItem = {
        url: pageUrl,
        statusCode: response.status(),
        statusText: response.statusText(),
        contentType: response.headers()['content-type'],
        isInternal: this.isInternalLink(responseUrl),
        depth,
      };
      if ([301, 302].includes(response.status())) {
        (resultItem as any).redirectUrl = response.headers()['location'];
        (resultItem as any).indexability = false;
        (resultItem as any).indexabilityStatus = 'Redirected';
      }
      this.markItemAsProcessed(resultItem);
    }
  }

  private getRobotsBlockedResult(singlePageUrl: string, depth: number): any {
    const response = new Response(null, {
      status: 0,
      statusText: 'Blocked by robots.txt'
    });
    return {
      url: singlePageUrl,
      response,
      depth,
    };
  }

  private getPageInfoResponse(response: Response): any {
    return {
      statusCode: response.status(),
      statusText: response.statusText(),
      contentType: response.headers()['content-type'],
      robotsHeader: response.headers()['x-robots-tag'],
    };
  }

  private getErrorResponse(singlePageUrl: string, reason: string): Response {
    return Response.new
  }
  
  private async isAllowedByRobotsTxt(singlePageUrl: any, userAgent: string): Promise<boolean> {
    if (this.robotsIsIgnored || typeof this.robotsChecker == 'undefined') {
      return true;
    }

    return await this.robotsChecker
      .isAllowed(singlePageUrl, userAgent)
      .catch((ex: any) =>
        this.emit('error', `cannot evaluate robots.txt related to url: ${singlePageUrl}, exception: ${ex.toString()}`),
      );
  }
  
  private getNormalizedLink(currentPageUrl: URL): string {
    const href = currentPageUrl.href;
    return currentPageUrl.hash!==null?href.replace(currentPageUrl.hash, ''): href;
  }

  private isExceedingMaxResults(): boolean {
    return typeof this.maxResultsNum != 'undefined' && this.pagesProcessed.size >= this.maxResultsNum;
  }
}
