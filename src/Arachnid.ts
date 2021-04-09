import { EventEmitter } from 'events';
import Puppeteer, { Browser, LaunchOptions, Response } from 'puppeteer';
import Queue from 'queue-fifo';
import { URL } from 'url';

import PageCrawler from './PageCrawler';
import RobotsChecker from './RobotsChecker';
import Link from './Link';
import {
  CrawlPageResult,
  IndexabilityInfo,
  ResultInfo
} from './types/arachnid';
import { ExtractedInfo } from './types/mainExtractor';

export default class Arachnid extends EventEmitter {
  private domain: URL;
  private puppeteerOptions: LaunchOptions;
  private maxDepth?: number;
  private maxResultsNum?: number;
  private concurrencyNum: number;
  private urlsToVisitQ: Queue<Link>;
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
    this.urlsToVisitQ.enqueue(new Link(this.domain.toString(), 1));
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

  private getNextPageBatch(): Set<Link> {
    const urlsToVisit = new Set<Link>();
    let i = 0;
    while (i < this.concurrencyNum && !this.urlsToVisitQ.isEmpty()) {
      const currentLink = this.urlsToVisitQ.dequeue() as Link;
      const normalizedCurrentLink = currentLink.getNormalizedLink();
      if (this.shouldProcessPage(normalizedCurrentLink)) {
        urlsToVisit.add(currentLink);
        i++;
      }
    }
    return urlsToVisit;
  }

  private shouldProcessPage(normalizedPageUrl: string): boolean {
    return !this.pagesProcessed.has(normalizedPageUrl);
  }

  private async processPageBatch(pagesToVisit: Set<Link>): Promise<ResultInfo[]> {
    const browser = await Puppeteer.launch({ headless: true, ...this.puppeteerOptions });
    const crawlPromises: Promise<CrawlPageResult>[] = [];
    const pageCrawler = new PageCrawler(this.followSubDomains, this.robotsIsIgnored, this.robotsChecker);
    this.registerEvents(pageCrawler);

    pagesToVisit.forEach((pageLink: Link) => {
      try {
        crawlPromises.push(pageCrawler.crawlPage(pageLink, browser));
      } catch (error) {
        this.emit('error', `Failed to crawl page link, error:${error}`);
      }
    });
    const results: ResultInfo[] = [];
    await Promise.all(crawlPromises)
      .then((allPagesData) => {
        allPagesData.forEach((data: CrawlPageResult) => {
          const { link, response, extractedInfo, depth, resourceInfo } = data;
          let pageInfoResult: ResultInfo = {
            url: decodeURI(link.getPageUrl().href),
            urlEncoded: link.getPageUrl().href,
            isInternal: response !== null && link.isInternalLink(),
            statusCode: response !== null ? response.status() : 0,
            statusText: response !== null ? response.statusText() : '',
            contentType: response !== null && response.headers() !== null ? response.headers()['content-type'] : null,
            robotsHeader: response !== null && response.headers() !== null ? response.headers()['x-robots-tag'] : null,
            depth,
            resourceInfo,
            parentLink: link.getParentLink(),
          };
          if (extractedInfo) {
            this.addChildrenToQueue(extractedInfo, depth, link);
            delete extractedInfo.links;
            pageInfoResult = { ...pageInfoResult, DOMInfo: extractedInfo };
          }
          const indexableInfo = this.extractIndexability(pageInfoResult);
          pageInfoResult = { ...pageInfoResult, ...indexableInfo };
          results.push(pageInfoResult);
        });
      })
      .catch((error) => {
        const urlsAsTxt = [...pagesToVisit].map((item) => item.getPageUrl().href).join(', ');
        this.emit('error', `Failed to resolve batch ${urlsAsTxt}, error:${error}`);
      });
    browser.close();
    return results;
  }

  private addChildrenToQueue(extractedInfo: ExtractedInfo, depth: number, link: Link) {
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
        this.urlsToVisitQ.enqueue(new Link(urlString, depth + 1, link));
      } catch (ex) {
        this.emit('pageCrawlingSkipped', { url: decodeURI(urlString), reason: ex.toString() });
        const invalidURLResults: ResultInfo = {
          url: decodeURI(urlString),
          urlEncoded: urlString,
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

  private isExceedingMaxResults(): boolean {
    return typeof this.maxResultsNum !== 'undefined' && this.pagesProcessed.size >= this.maxResultsNum;
  }

  private registerEvents(pageCrawler: PageCrawler) {
    this.eventNames().forEach((eventName) => {
      this.listeners(eventName).forEach((listener) => {
        pageCrawler.on(eventName, listener as (...args: any[]) => void);
      });
    });

    pageCrawler.on('pageItemVisited', (resultItem: ResultInfo) => {
      if (!this.pagesProcessed.has(resultItem.url)) {
        this.markItemAsProcessed(resultItem);
      }
    });
  }
}
