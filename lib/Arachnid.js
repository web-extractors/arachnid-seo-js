'use strict'

const Events = require('events');
const Puppeteer = require('puppeteer');
const Queue = require('queue-fifo');
const mainExtractor = require('./mainExtractor');
const RobotsChecker = require('./RobotsChecker');

class Arachnid extends Events {
  constructor(domain) {
    super();
    if (!this._isValidHttpUrl(domain)) {
      throw Error('Please enter full website URL with protocol (http or https)');
    }
    this.domain = new URL(domain);
    this.params = [];
    this.maxDepth = 1;
    this.concurrencyNum = 1;
    this.urlsToVisitQ = new Queue();
    this.pagesProcessed = new Map();
    this.followSubDomains = false;
  }

  /**
   * @method setCrawlDepth
   * @param {number} depth - set concurrency number
   */ 
  setCrawlDepth(depth) {
    this.maxDepth = depth;
    return this;
  }

  /**
   * @method setConcurrency 
   * @param {number} concurrencyNum - set pages to crawl depth
   */ 
  setConcurrency(concurrencyNum) {
    this.concurrencyNum = concurrencyNum;
    return this;
  }


  /**
   * @method setPuppeteerParameters
   * @param {Array} parameters - set list of arguments used by Puppeteer (this.args)
   */ 
  setPuppeteerParameters(parameters) {
    this.params = parameters;
    return this;
  }

  /**
   * @method shouldFollowSubdomains
   * @param {boolean} shouldFollow- enable or disable following links for subdomains of main domain 
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
    this.robotsChecker = new RobotsChecker(this.params);
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
        const { url, extractedInfo, depth, headers, statusCode, statusText, indexability } = data;
        let pageInfoResult = {
          url,
          isInternal: this.isInternalLink(new URL(url)),
          statusCode,
          statusText,
          indexability,
          contentType: headers['content-type'],
          robotsHeader: headers['x-robots-tag'],
          depth
        };
        if (extractedInfo) {
          pageInfoResult.linksCount = extractedInfo.links.length;
          this.addChildrenToQueue(extractedInfo, depth);
          delete extractedInfo.links;
          pageInfoResult = { ...pageInfoResult, ...extractedInfo };
        }
        if (indexability === undefined) {
          pageInfoResult.indexability = this.extractIndexability(pageInfoResult);
        }

        results.push(pageInfoResult);
        this.emit('pageCrawlingFinished', { url: pageInfoResult.url, pageInfoResult: pageInfoResult });
      });
    }).catch(error => {
      const urlsAsTxt = [...pagesToVisit].map(item => item.url.href).join(', ');
      this.emit('error', `Failed to resolve batch ${urlsAsTxt}, error:${error}`);
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

  extractIndexability(pageInfoResult) {
    if (pageInfoResult.robotsHeader &&
      pageInfoResult.robotsHeader.includes("nofollow")) {
      return false;
    } else if (pageInfoResult.meta &&
      pageInfoResult.meta.robots &&
      pageInfoResult.meta.robots.includes("nofollow")) {
      return false;
    } else {
      return true;
    }
  }

  async crawlPage(browser, singlePageLink) {
    const page = await browser.newPage();
    const singlePageUrl = singlePageLink.url.toString();
    const userAgent = await browser.userAgent();
    const isAllowedByRobotsTxt = await this.robotsChecker.isAllowed(singlePageUrl, userAgent)
      .catch(ex => this.emit('error', `cannot evaluate robots, exception: ${ex.toString()}`));
    if (isAllowedByRobotsTxt === false) {
      return {
        url: singlePageUrl,
        statusCode: 0,
        statusText: "Blocked by robots.txt",
        headers: {},
        indexability: false,
        indexabilityStatus: "Blocked by robots.txt",
        depth: singlePageLink.depth
      };
    }
    this.emit('pageCrawlingStarted', { url: singlePageUrl, depth: singlePageLink.depth });
    page.on('response', async (response) => {
      if ((response.status() >= 300) && (response.status() <= 399)) {
        this.handleRedirect(response, singlePageLink.depth);
      }
    });

    let result;
    try {
      const response = await page.goto(this.getNormalizedLink(singlePageLink.url), { waitUntil: 'domcontentloaded', timeout: 0 });

      let extractedInfo;
      if (response.status() > 399) {
        this.emit('pageCrawlingFailed', { url: singlePageUrl, statusCode: response.status() });
      } else {
        this.emit('pageCrawlingSuccessed', { url: singlePageUrl, statusCode: response.status() });
        if (this.shouldExtractInfo(singlePageLink.url, response)) {
          extractedInfo = await mainExtractor(page);
        }
      }
      result = {
        url: singlePageUrl,
        statusCode: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        extractedInfo,
        depth: singlePageLink.depth
      };
    } catch (ex) {
      result = {
        url: singlePageUrl,
        statusCode: 0,
        statusText: ex.toString(),
        headers: {},
        depth: singlePageLink.depth
      }
    }
    page.close();
    return result;
  }

  handleRedirect(response, depth) {
    const responseUrl = new URL(response.url());
    const pageUrl = this.getNormalizedLink(responseUrl);
    this.markItemAsProcessed({
      url: pageUrl,
      statusCode: response.status(),
      statusText: response.statusText(),
      redirectUrl: response.headers()['location'],
      contentType: response.headers()['content-type'],
      isInternal: this.isInternalLink(responseUrl),
      depth: depth
    });
  }

  getNormalizedLink(currentPageUrl) {
    return currentPageUrl.href.replace(currentPageUrl.hash, "");
  }
}

module.exports = Arachnid;
