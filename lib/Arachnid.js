'use strict'

const puppeteer = require('puppeteer');
const mainExtractor = require('./mainExtractor');
const Queue = require('queue-fifo');

class Arachnid {
  /**
   * entry point to crawling
   * @param {string} - domain
   * @param {number} - maxDepth
   * @param {number} - maxDepth
   * @param {number} - concurrency number
   * @param {Array} - list of arguments used by Puppeteer (this.args)
   */
  constructor(domain, maxDepth, concurrencyNum, args) {
    this.mainPageUrl = new URL(domain);
    this.maxDepth = maxDepth;
    this.concurrencyNum = concurrencyNum;
    this.args = args;
  }

  async traverse() {
    const browser = await puppeteer.launch({ headless: true, args: this.args });
    const pagesToVisitQ = new Queue();
    const pagesProcessed = new Map();
    pagesToVisitQ.enqueue({ url: this.mainPageUrl, depth: 1 });
    while (!pagesToVisitQ.isEmpty()) {
      const urlsToProcess = this.getNextPageBatch(pagesToVisitQ, pagesProcessed);
      const pagesInfoResult = await this.processPageBatch(browser, pagesToVisitQ, urlsToProcess);
      pagesInfoResult.forEach(item => {
        pagesProcessed.set(item.pageUrl, item);
      });
    }

    await browser.close();

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
     return currentPageUrl.host === this.mainPageUrl.host;
  }

  async processPageBatch(browser, pagesToVisitQ, pagesToVisit) {
    const crawlPromises = [];
    pagesToVisit.forEach(page => {
      crawlPromises.push(this.crawlPage(browser, page));
    });

    const results = [];
    await Promise.all(crawlPromises).then(allPagesData => {
      allPagesData.forEach(data => {
        const { response, extractedInfo, depth } = data;
        if (depth < this.maxDepth) {
          extractedInfo.links.forEach(link => {
            pagesToVisitQ.enqueue({ url: new URL(link), depth: depth + 1 });
          });
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
      });

    }).catch(err => {
      console.log('errors: ', err);
    });

    return results;
  }

  async crawlPage(browser, singlePageLink) {
    const page = await browser.newPage();
    const response = await page.goto(this.getNormalizedLink(singlePageLink.url), { waitUntil: 'domcontentloaded', timeout: 0 });
    const extractedInfo = await mainExtractor(page);
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
}

module.exports = Arachnid;