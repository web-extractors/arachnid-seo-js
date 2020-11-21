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
    this.pagesProcessed.set(item.url, item);
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
      try {
        crawlPromises.push(this.crawlPage(browser, page));
      } catch (error) {
        this.emit('error', `Failed to crawl page, error:${error}`);
      }
    });

    const results = [];
    await Promise.all(crawlPromises).then(allPagesData => {
      allPagesData.forEach(data => {
        const { url, response, extractedInfo, depth, isInternal } = data;
        let pageInfoResult = {
          url,
          isInternal,
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

  addChildrenToQueue(extractedInfo, depth) {
    if (depth < this.maxDepth) {
      extractedInfo.links.forEach(link => {
        try {
          const extractedUrl = new URL(link);
          this.urlsToVisitQ.enqueue({ url: extractedUrl, depth: depth + 1 });
        } catch (ex) {
          this.emit("pageCrawlingSkipped", { url: link, reason: ex.toString() });
        }
      });
    }
  }

  shouldExtractInfo(currentPageUrl, response) {
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

  isSameHost(currentPageUrl) {
    return currentPageUrl.host === this.domain.host;
  }

  isSubDomain(currentPageUrl) {
    const strippedMainHost = this.domain.hostname.replace("www.", "");
    return currentPageUrl.hostname.endsWith(`.${strippedMainHost}`);
  }

  isInternalLink(currentPageUrl) {
    return this.isSameHost(currentPageUrl) || this.isSubDomain(currentPageUrl);
  }

  async crawlPage(browser, singlePageLink) {
    const page = await browser.newPage();
    this.emit('pageCrawlingStarted', { url: singlePageLink.url.toString(), depth: singlePageLink.depth });
    page.on('response', response => {
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
      depth: singlePageLink.depth,
      isInternal: this.isInternalLink(singlePageLink.url)
    };
  }

  getNormalizedLink(currentPageUrl) {
    return currentPageUrl.href.replace(currentPageUrl.hash, "");
  }
}

module.exports = Arachnid;
