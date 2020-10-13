'use strict'

const events = require('events')
const puppeteer = require('puppeteer')
const Queue = require('queue-fifo')
const mainExtractor = require('./mainExtractor')

class Arachnid extends events {
  constructor() {
    super();
    this.domain = ''
    this.params = []
    this.maxDepth = 1
    this.concurrencyNum = 1
  }

  setDomain(domain) {
    if (!this._isValidHttpUrl(domain)) {
      throw Error('Please enter website url has secure protocol "https"')
    }
    this.domain = new URL(domain);
    return this
  }

  setCrawlDepth(depth) {
    this.maxDepth = depth;
    return this;
  }

  setConcurrency(concurrencyNum) {
    this.concurrencyNum = concurrencyNum;
    return this;
  }

  setParameters(parameters) {
    this.params = parameters;
    return this;
  }

  build() {
    return new Arachnid(this);
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
    const browser = await puppeteer.launch({ headless: true, args: this.params });
    const pagesToVisitQ = new Queue();
    const pagesProcessed = new Map();
    pagesToVisitQ.enqueue({ url: this.domain, depth: 1 });
    while (!pagesToVisitQ.isEmpty()) {
      const urlsToProcess = this.getNextPageBatch(pagesToVisitQ, pagesProcessed);
      const pagesInfoResult = await this.processPageBatch(browser, pagesToVisitQ, urlsToProcess);
      pagesInfoResult.forEach(item => {
        pagesProcessed.set(item.pageUrl, item);
      })
    }

    await browser.close();
    this.emit('info', 'closing browser connecion');
    this.emit('results', pagesProcessed);
    return pagesProcessed;
  }

  getNextPageBatch(pagesToVisitQ, pagesProcessed) {
    const urlsToVisit = new Set();
    let i = 0;
    while (i < this.concurrencyNum && !pagesToVisitQ.isEmpty()) {
      const currentPage = pagesToVisitQ.dequeue();
      const currentPageUrl = currentPage.url;
      if (this.shouldProcessPage(currentPageUrl, pagesProcessed)) {
        urlsToVisit.add(currentPage);
        i++;
      }
    }
    return urlsToVisit;
  }

  shouldProcessPage(currentPageUrl, pagesProcessed) {
    return !pagesProcessed.has(this.getNormalizedLink(currentPageUrl)) &&
      this.shouldVisit(currentPageUrl);
  }

  shouldVisit(currentPageUrl) {
    //TODO: amend the condition to take into account subdomain links
    //TODO: check that pages are non-broken only if external and add to the results map
    return currentPageUrl.host === this.domain.host;
  }

  async processPageBatch(browser, pagesToVisitQ, pagesToVisit) {
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
            pagesToVisitQ.enqueue({ url: new URL(link), depth: depth + 1 });
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
        this.emit('pageCrawlingFinished', {url:pagesInfoResult.url, statusCode: pagesInfoResult.statusCode});
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
    const extractedInfo = await mainExtractor(page);
    page.close();
    this.emit('pageResponseReceived', { url: singlePageLink.url.toString(), statusCode: response.status() });
    if (response.statusCode() > 399) {
      this.emit('pageCrawlingFailed', { url: singlePageLink.url.toString(), statusCode: response.status() });
    }

    const output = {
      response,
      extractedInfo,
      depth: singlePageLink.depth
    }

    return output;
  }

  getNormalizedLink(currentPageUrl) {
    return currentPageUrl.toString();
  }

  safeErrorEmitter(err) {
    if (this.listenerCount('error').length > 0) {
      this.emit('error', err);
    }
  }
}

module.exports = Arachnid;
