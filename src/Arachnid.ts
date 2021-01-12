import { EventEmitter } from 'events';
import Puppeteer, { Browser, LaunchOptions, Response } from 'puppeteer';
import Queue from 'queue-fifo';
import { URL } from 'url';

import { extractor as mainExtractor } from './mainExtractor';
import RobotsChecker from './RobotsChecker';
import {
  CrawlPageResult,
  ErrorResponse,
  IndexabilityInfo,
  ResultInfo,
  UrlWithDepth,
  PageResourceType,
} from './types/arachnid';
import { ExtractedInfo } from './types/mainExtractor';

export default class Arachnid extends EventEmitter {
  private domain: URL;
  private puppeteerOptions: LaunchOptions;
  private maxDepth?: number;
  private maxResultsNum?: number;
  private concurrencyNum: number;
  private urlsToVisitQ: Queue<UrlWithDepth>;
  private pagesProcessed: Map<string, ResultInfo>;
  private followSubDomains: boolean;
  private robotsIsIgnored: boolean;
  private robotsChecker: RobotsChecker | undefined;

  constructor(protected domainString: string) {
    super();
    if (!this.isValidHttpUrl(domainString)) {
      throw Error('Please enter full website URL with protocol (http or https)');
    }
    this.domain = new URL(domainString);
    this.puppeteerOptions = {};
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
   * @method setPuppeteerOptions
   * @description set Puppeteer Launch Options
   * @param {Object} options - puppeteer launch options
   */
  public setPuppeteerOptions(options: LaunchOptions) {
    this.puppeteerOptions = options;
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

  private isValidHttpUrl(urlString: string) {
    let url;
    try {
      url = new URL(urlString);
    } catch (_) {
      return false;
    }
    return url.protocol === 'https:' || url.protocol === 'http:';
  }

  public async traverse(): Promise<Map<string, ResultInfo>> {
    this.robotsChecker = new RobotsChecker(this.puppeteerOptions);
    if (typeof this.maxDepth === 'undefined' && typeof this.maxResultsNum === 'undefined') {
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
      for (const item of pagesInfoResults) {
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

  private markItemAsProcessed(item: ResultInfo) {
    if (!this.isExceedingMaxResults()) {
      this.pagesProcessed.set(item.url, item);
      this.emit('pageCrawlingFinished', { url: item.url, pageInfoResult: item });
    }
  }

  private getNextPageBatch(): Set<UrlWithDepth> {
    const urlsToVisit = new Set<UrlWithDepth>();
    let i = 0;
    while (i < this.concurrencyNum && !this.urlsToVisitQ.isEmpty()) {
      const currentPage = this.urlsToVisitQ.dequeue() as UrlWithDepth;
      const normalizedCurrentLink = this.getNormalizedLink(currentPage.url);
      if (this.shouldProcessPage(normalizedCurrentLink)) {
        urlsToVisit.add(currentPage);
        i++;
      }
    }
    return urlsToVisit;
  }

  private shouldProcessPage(normalizedPageUrl: string): boolean {
    return !this.pagesProcessed.has(normalizedPageUrl);
  }

  private async processPageBatch(pagesToVisit: Set<UrlWithDepth>): Promise<ResultInfo[]> {
    const browser = await Puppeteer.launch({ headless: true, ...this.puppeteerOptions });
    const crawlPromises: Promise<CrawlPageResult>[] = [];
    pagesToVisit.forEach((pageLink: UrlWithDepth) => {
      try {
        crawlPromises.push(this.crawlPage(browser, pageLink));
      } catch (error) {
        this.emit('error', `Failed to crawl page link, error:${error}`);
      }
    });
    const results: ResultInfo[] = [];
    await Promise.all(crawlPromises)
      .then((allPagesData) => {
        allPagesData.forEach((data: CrawlPageResult) => {
          const { url, response, extractedInfo, depth, resourceInfo } = data;
          let pageInfoResult: ResultInfo = {
            url,
            isInternal: response !== null && response.status() !== 0 ? this.isInternalLink(new URL(url)) : false,
            statusCode: response !== null ? response.status() : 0,
            statusText: response !== null ? response.statusText() : '',
            contentType: response !== null && response.headers() !== null ? response.headers()['content-type'] : null,
            robotsHeader: response !== null && response.headers() !== null ? response.headers()['x-robots-tag'] : null,
            depth,
            resourceInfo,
          };
          if (extractedInfo) {
            this.addChildrenToQueue(extractedInfo, depth);
            delete extractedInfo.links;
            pageInfoResult = { ...pageInfoResult, DOMInfo: extractedInfo };
          }
          const indexableInfo = this.extractIndexability(pageInfoResult);
          pageInfoResult = { ...pageInfoResult, ...indexableInfo };
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

  private addChildrenToQueue(extractedInfo: ExtractedInfo, depth: number) {
    const depthInLimit = typeof this.maxDepth === 'undefined' || depth < this.maxDepth;
    let i = 0;
    while (depthInLimit && extractedInfo?.links && i < extractedInfo.links.length) {
      const urlString = extractedInfo.links[i++];
      if (this.pagesProcessed.has(urlString)) {
        continue;
      }
      const resultsNumInLimit =
        typeof this.maxResultsNum === 'undefined' ||
        this.pagesProcessed.size + this.urlsToVisitQ.size() < this.maxResultsNum;
      if (!resultsNumInLimit) {
        break;
      }
      try {
        const url = new URL(urlString);
        this.urlsToVisitQ.enqueue({ url, depth: depth + 1 });
      } catch (ex) {
        this.emit('pageCrawlingSkipped', { url: urlString, reason: ex.toString() });
        const invalidURLResults: ResultInfo = {
          url: urlString,
          isInternal: false,
          statusCode: 0,
          statusText: 'Invalid URL',
          isIndexable: false,
          indexabilityStatus: 'Invalid URL',
          depth: depth + 1,
        };
        this.markItemAsProcessed(invalidURLResults);
      }
    }
  }

  private shouldExtractInfo(currentPageUrl: URL, response: Response | ErrorResponse): boolean {
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

  private isSameHost(currentPageUrl: URL): boolean {
    return currentPageUrl.host === this.domain.host;
  }

  private isSubDomain(currentPageUrl: URL): boolean {
    const strippedMainHost = this.domain.hostname.replace('www.', '');
    return currentPageUrl.hostname.endsWith(`.${strippedMainHost}`);
  }

  private isInternalLink(currentPageUrl: URL): boolean {
    return this.isSameHost(currentPageUrl) || this.isSubDomain(currentPageUrl);
  }

  private extractIndexability(pageInfoResult: ResultInfo): IndexabilityInfo {
    let isIndexable = true;
    let indexabilityStatus = '';
    if (pageInfoResult.robotsHeader && pageInfoResult.robotsHeader.includes('noindex')) {
      isIndexable = false;
      indexabilityStatus = 'noindex';
    } else if (pageInfoResult?.DOMInfo?.meta?.robots && pageInfoResult.DOMInfo.meta.robots.includes('noindex')) {
      isIndexable = false;
      indexabilityStatus = 'noindex';
    } else if (pageInfoResult.statusCode === 0) {
      isIndexable = false;
      indexabilityStatus = pageInfoResult.statusText;
    } else if (pageInfoResult.statusCode >= 400) {
      isIndexable = false;
      indexabilityStatus = 'Client Error';
    } else if (
      pageInfoResult?.DOMInfo?.canonicalUrl &&
      decodeURI(pageInfoResult.DOMInfo.canonicalUrl).toLowerCase() !== decodeURI(pageInfoResult.url).toLowerCase()
    ) {
      isIndexable = false;
      indexabilityStatus = 'Canonicalised';
    }
    return { isIndexable, indexabilityStatus };
  }

  private async crawlPage(browser: Browser, singlePageLink: UrlWithDepth): Promise<CrawlPageResult> {
    const singlePageUrl = singlePageLink.url.toString();
    const userAgent = await browser.userAgent();
    const isAllowedByRobotsTxt = await this.isAllowedByRobotsTxt(singlePageUrl, userAgent);
    if (!isAllowedByRobotsTxt) {
      this.emit('info', `${singlePageUrl} is blocked by robots.txt`);
      return this.getRobotsBlockedResult(singlePageUrl, singlePageLink.depth);
    }
    const page = await browser.newPage();
    const redirectChain = [singlePageUrl];
    const resourcesMap = new Map<string, PageResourceType>();
    page.on('response', async (subResponse: Response) => {
      if ([301, 302].includes(subResponse.status()) && redirectChain.includes(subResponse.url())) {
        redirectChain.push(subResponse.headers().location);
        const subrequestRobotsAllowed = await this.isAllowedByRobotsTxt(subResponse.url(), userAgent);
        if (!subrequestRobotsAllowed) {
          this.markResponseAsVisited(
            this.getErrorResponse(subResponse.url(), 'Blocked by robots.txt'),
            singlePageLink.depth,
          );
        } else {
          this.markResponseAsVisited(subResponse, singlePageLink.depth);
        }
      } else if (this.isInternalLink(singlePageLink.url)) {
        this.recordSubResource(subResponse, resourcesMap);
      }
    });
    this.emit('pageCrawlingStarted', { url: singlePageUrl, depth: singlePageLink.depth });
    const response: Response | ErrorResponse | null = await page
      .goto(this.getNormalizedLink(singlePageLink.url), { waitUntil: 'domcontentloaded', timeout: 0 })
      .catch((error: Error) => {
        if (error?.stack?.includes('ERR_NAME_NOT_RESOLVED')) {
          return this.getErrorResponse(singlePageUrl, 'Invalid Domain name, cannot be resolved');
        } else if (error?.stack?.includes('ERR_CONNECTION_REFUSED')) {
          return this.getErrorResponse(singlePageUrl, 'Connection refused');
        } else {
          return this.getErrorResponse(singlePageUrl, 'Unknown error');
        }
      });
    let extractedInfo;
    if (response === null || response.status() > 399 || response.status() === 0) {
      this.emit('pageCrawlingFailed', { url: singlePageUrl, statusCode: response !== null ? response.status() : 0 });
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
    await page.close().catch((e: Error) => {
      if (e.message.includes('Connection closed')) {
        return 0; // Either invalid request or a race condition
      }
    });
    const resultItem: CrawlPageResult = {
      url: response !== null ? response.url() : singlePageUrl,
      response: response !== null ? response : this.getErrorResponse(singlePageUrl, 'Unknown error'),
      extractedInfo,
      depth: singlePageLink.depth
    };

    if (this.isInternalLink(singlePageLink.url)) {
      resultItem.resourceInfo = Array.from(resourcesMap.values());
    }

    return resultItem;
  }

  private markResponseAsVisited(response: Response | ErrorResponse, depth: number) {
    const responseUrl = new URL(response.url());
    const pageUrl = this.getNormalizedLink(responseUrl);
    if (!this.pagesProcessed.has(pageUrl)) {
      const resultItem: ResultInfo = {
        url: pageUrl,
        statusCode: response.status(),
        statusText: response.statusText(),
        contentType: response.headers()['content-type'],
        isInternal: this.isInternalLink(responseUrl),
        robotsHeader: null,
        depth,
      };
      if ([301, 302].includes(response.status())) {
        resultItem.redirectUrl = response.headers().location;
        resultItem.isIndexable = false;
        resultItem.indexabilityStatus = 'Redirected';
      }
      this.markItemAsProcessed(resultItem);
    }
  }

  private getRobotsBlockedResult(singlePageUrl: string, depth: number): CrawlPageResult {
    const response = this.getErrorResponse(singlePageUrl, 'Blocked by robots.txt');
    return {
      url: singlePageUrl,
      response,
      depth,
    };
  }

  private getErrorResponse(singlePageUrl: string, reason: string): ErrorResponse {
    return {
      url: () => singlePageUrl,
      status: () => 0,
      statusText: () => reason,
      headers: () => {
        return {};
      },
    };
  }

  private recordSubResource(subResponse: Response, resourcesMap: Map<string, PageResourceType>) {
    const isBroken = subResponse.status() >= 400;
    const resourceType = subResponse.request().resourceType();
    if (!resourcesMap.has(resourceType)) {
      resourcesMap.set(resourceType, { type: resourceType, count: 0, broken: [] });
    }
    const resourceItem = resourcesMap.get(resourceType)!;
    resourceItem.count++;
    if (isBroken) {
      resourceItem.broken.push(subResponse.url());
    }
    resourcesMap.set(resourceType, resourceItem);
  }

  private async isAllowedByRobotsTxt(singlePageUrl: string, userAgent: string): Promise<boolean> {
    if (this.robotsIsIgnored || typeof this.robotsChecker === 'undefined') {
      return true;
    }

    return await this.robotsChecker
      .isAllowed(singlePageUrl, userAgent)
      .catch((ex: Error) =>
        this.emit('error', `cannot evaluate robots.txt related to url: ${singlePageUrl}, exception: ${ex.toString()}`),
      );
  }

  private getNormalizedLink(currentPageUrl: URL): string {
    const href = currentPageUrl.href;
    return currentPageUrl.hash !== null ? href.replace(currentPageUrl.hash, '') : href;
  }

  private isExceedingMaxResults(): boolean {
    return typeof this.maxResultsNum !== 'undefined' && this.pagesProcessed.size >= this.maxResultsNum;
  }
}
