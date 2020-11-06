'use strict'

const Events = require('events');
const Puppeteer = require('puppeteer');
const Queue = require('queue-fifo');
const mainExtractor = require('./mainExtractor');

class Arachnid extends Events {
  /**
   * entry point to crawling using builder pattern 
   * @method setDomain
   * @method setCrawlDepth
   * @method setConcurrency
   * @method setPuppeteerParameters
   */
  constructor() {
    super();
    this.domain = '';
    this.params = [];
    this.maxDepth = 1;
    this.concurrencyNum = 1;
    this.urlsToVisitQ = new Queue();
    this.pagesProcessed = new Map();
    this.followSubDomains = false;
  }

  /**
   * @param {string} - set main page to crawl
   */
  setDomain(domain) {
    if (!this._isValidHttpUrl(domain)) {
      throw Error('Please enter full website URL with protocol (http or https)');
    }
    this.domain = new URL(domain);
    return this;
  }

  /**
   * @param {number} - set pages to crawl depth
   */
  setCrawlDepth(depth) {
    this.maxDepth = depth;
    return this;
  }

  /**
   * @param {number} - set concurrency number
   */
  setConcurrency(concurrencyNum) {
    this.concurrencyNum = concurrencyNum;
    return this;
  }

  /**
   * @param {Array} - set list of arguments used by Puppeteer (this.args)
   */
  setPuppeteerParameters(parameters) {
    this.params = parameters;
    return this;
  }

  /**
   * @param {boolean} - enable or disable following links for subdomains of main domain
   */
  shouldFollowSubdomains(shouldFollow) {
    this.followSubDomains = shouldFollow;
    return this;
  }

  _isValidHttpUrl(string) {
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
      pagesInfoResult.forEach(item => {
        this.markItemAsProcessed(item);
      })
    }

    this.emit('results', this.pagesProcessed);
    return this.pagesProcessed;
  }

  markItemAsProcessed(item) {
    if ([301, 302].includes(item.originalStatusCode)) {
      this.pagesProcessed.set(this.getNormalizedLink(new URL(item.originalUrl)), { statusCode: item.originalStatusCode });
    }

    delete item.originalStatusCode;
    delete item.originalUrl;
    this.pagesProcessed.set(item.pageUrl, item);
  }

  getNextPageBatch() {
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

  shouldProcessPage(normalizedPageUrl) {
    return !this.pagesProcessed.has(normalizedPageUrl);
  }

  async processPageBatch(pagesToVisit) {
    const browser = await Puppeteer.launch({ headless: true, args: this.params });
    const crawlPromises = [];
    pagesToVisit.forEach(page => {
      crawlPromises.push(this.crawlPage(browser, page));
    });

    const results = [];
    await Promise.all(crawlPromises).then(allPagesData => {
      allPagesData.forEach(data => {
        const { response, extractedInfo, depth, originalStatusCode, originalUrl } = data;
        this.addChildrenToQueue(extractedInfo, depth);
        delete extractedInfo.links;
        const pageInfoResult = {
          pageUrl: extractedInfo.url,
          statusCode: response.status(),
          statusText: response.statusText(),
          contentType: response.headers()['content-type'],
          depth,
          originalStatusCode,
          originalUrl,
          ...extractedInfo,
        };
        results.push(pageInfoResult);
        this.emit('pageCrawlingFinished', { url: pageInfoResult.url, pageInfoResult: pageInfoResult });
      });
    }).catch(err => {
      this.safeErrorEmitter(err);
    });

    browser.close();
    return results;
  }

  addChildrenToQueue(extractedInfo, depth) {
    if (depth < this.maxDepth) {
      extractedInfo.links.forEach(link => {
        try {
          const extractedUrl = new URL(link);
          if (this.shouldAddToQueue(extractedUrl)) {
            this.urlsToVisitQ.enqueue({ url: extractedUrl, depth: depth + 1 });
          }
        } catch (ex) {
          this.emit("pageCrawlingSkipped", { link: link, reason: ex.toString() });
        }
      });
    } else {
      //TODO: reached max depth, we should just validate the links are non-broken 200 status code
    }
  }

  shouldAddToQueue(currentPageUrl) {
    const strippedMainHost = this.domain.hostname.replace("www.","");
    const isSameHost = currentPageUrl.host === this.domain.host;
    const isSubDomain = currentPageUrl.hostname.endsWith(`.${strippedMainHost}`);
    let shouldFollow = false;
    if (this.followSubDomains && isSubDomain ) {
      shouldFollow = true;
    } else if (isSameHost) {
      shouldFollow = true;
    } else {
      this.emit("pageCrawlingSkipped", { link: currentPageUrl.toString(), reason: "External Url" });
    }
  
    return shouldFollow && this.shouldProcessPage(this.getNormalizedLink(currentPageUrl));
  }

  async crawlPage(browser, singlePageLink) {
    const page = await browser.newPage();
    let originalStatusCode = null;
    let originalUrl = null;
    this.emit('pageCrawlingStarted', { url: singlePageLink.url.toString(), depth: singlePageLink.depth });
    page.on('response', response => {
      if (originalStatusCode == null) {
        originalStatusCode = response.status();
        originalUrl = response.url();
      }
    });
    const response = await page.goto(this.getNormalizedLink(singlePageLink.url), { waitUntil: 'domcontentloaded', timeout: 0 });

    let extractedInfo;
    if (response.status() > 399) {
      this.emit('pageCrawlingFailed', { url: singlePageLink.url.toString(), statusCode: response.status() });
    } else {
      this.emit('pageCrawlingSuccessed', { url: singlePageLink.url.toString(), statusCode: response.status() });
      extractedInfo = await mainExtractor(page);
    }
    page.close();

    return {
      response,
      extractedInfo,
      depth: singlePageLink.depth,
      originalUrl,
      originalStatusCode
    };
  }

  getNormalizedLink(currentPageUrl) {
    return currentPageUrl.href.replace(currentPageUrl.hash, "");
  }

  safeErrorEmitter(err) {
    if (this.listenerCount('error').length > 0) {
      this.emit('error', err);
    }
  }
}

module.exports = Arachnid;
