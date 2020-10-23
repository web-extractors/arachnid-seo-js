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
    this.pagesToVisitQ = new Queue();
    this.pagesProcessed = new Map();
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
    const browser = await Puppeteer.launch({ headless: true, args: this.params });
    this.pagesToVisitQ.enqueue({ url: this.domain, depth: 1 });
    while (!this.pagesToVisitQ.isEmpty()) {
      const urlsToProcess = this.getNextPageBatch();
      const pagesInfoResult = await this.processPageBatch(browser, urlsToProcess);
      pagesInfoResult.forEach(item => {
        this.pagesProcessed.set(item.pageUrl, item);
      })
    }

    await browser.close();
    this.emit('info', 'closing browser connecion');
    this.emit('results', this.pagesProcessed);
    return this.pagesProcessed;
  }

  getNextPageBatch() {
    const urlsToVisit = new Set();
    let i = 0;
    while (i < this.concurrencyNum && !this.pagesToVisitQ.isEmpty()) {
      const currentPage = this.pagesToVisitQ.dequeue();
      const currentPageUrl = currentPage.url;
      if (this.shouldProcessPage(currentPageUrl)) {
        urlsToVisit.add(currentPage);
        i++;
      }
    }
    return urlsToVisit;
  }

  shouldProcessPage(currentPageUrl) {
    return !this.pagesProcessed.has(this.getNormalizedLink(currentPageUrl)) &&
      this.shouldVisit(currentPageUrl);
  }

  shouldVisit(currentPageUrl) {
    //TODO: amend the condition to take into account subdomain links
    //TODO: check that pages are non-broken only if external and add to the results map
    return currentPageUrl.host === this.domain.host;
  }

  async processPageBatch(browser, pagesToVisit) {
    const crawlPromises = [];
    pagesToVisit.forEach(page => {
      crawlPromises.push(this.crawlPage(browser, page));
    })

    const results = [];
    await Promise.all(crawlPromises).then(allPagesData => {
      allPagesData.forEach(data => {
        const { response, extractedInfo, depth } = data;
        if (depth < this.maxDepth) {
          extractedInfo.links.forEach(link => {
            this.pagesToVisitQ.enqueue({ url: new URL(link), depth: depth + 1 });
          })
        } else {
          //TODO: reached max depth, we should just validate the links are non-broken 200 status code
        }
        delete extractedInfo.links;
        const pageInfoResult = {
          pageUrl: extractedInfo.url,
          statusCode: response.status(),
          statusText: response.statusText(),
          contentType: response.headers()['content-type'],
          depth,
          ...extractedInfo,
        };
        results.push(pageInfoResult);
        this.emit('pageCrawlingFinished', {url:pageInfoResult.url, pageInfoResult: pageInfoResult});
      })
    }).catch(err => {
      this.safeErrorEmitter(err);
    })

    return results;
  }

  async crawlPage(browser, singlePageLink) {
    const page = await browser.newPage();
    this.emit('pageCrawlingStarted', { url: singlePageLink.url.toString() });
    
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
      depth: singlePageLink.depth
    }
  }

  getNormalizedLink(currentPageUrl) {
    return currentPageUrl.href;
  }

  safeErrorEmitter(err) {
    if (this.listenerCount('error').length > 0) {
      this.emit('error', err);
    }
  }
}

module.exports = Arachnid;
