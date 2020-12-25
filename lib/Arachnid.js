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
    this.ignoreRobots = false;
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
   * @method setIgnoreRobots
   * @param {boolean} ignoreRobots - ignore allow/disallow rules written in robots.txt (robots.txt support enabled by default)
   */
  setIgnoreRobots(ignoreRobots) {
    this.ignoreRobots = ignoreRobots;
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
        const { url, response, extractedInfo, depth } = data;
        let pageInfoResult = {
          url,
          isInternal: this.isInternalLink(new URL(url)),
          statusCode: response.status(),
          statusText: response.statusText(),
          contentType: response.headers()['content-type'],
          robotsHeader: response.headers()['x-robots-tag'],
          depth
        };
        if (extractedInfo) {
          pageInfoResult.linksCount = extractedInfo.links.length;
          this.addChildrenToQueue(extractedInfo, depth);
          delete extractedInfo.links;
          pageInfoResult = { ...pageInfoResult, ...extractedInfo };
        }
        const indexableInfo = this.extractIndexability(pageInfoResult);
        pageInfoResult.indexability = indexableInfo.isIndexable;
        pageInfoResult.indexabilityStatus = indexableInfo.indexabilityStatus;

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
      extractedInfo.links.forEach(urlString => { 
        try {
          const url = new URL(urlString);
          this.urlsToVisitQ.enqueue({ url: url, depth: depth + 1 });
        } catch (ex) {
          this.emit('pageCrawlingSkipped', { url: urlString, reason: ex.toString() });
          this.markItemAsProcessed({url: urlString, depth: depth + 1});
        }
      });
    }
  }

  shouldExtractInfo(currentPageUrl, response) {
    if (response.headers()['content-type'] && !response.headers()['content-type'].includes('text/html')) {
      this.emit('pageCrawlingSkipped', { url: currentPageUrl.toString(), reason: `Content is non html (${response.headers()['content-type']})` });
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
    let isIndexable = true;
    let indexabilityStatus = "";
    if (pageInfoResult.robotsHeader &&
      pageInfoResult.robotsHeader.includes("noindex")) {
      isIndexable = false;
      indexabilityStatus = "noindex";
    } else if (pageInfoResult.meta &&
      pageInfoResult.meta.robots &&
      pageInfoResult.meta.robots.includes("noindex")) {
      isIndexable = false;
      indexabilityStatus = "noindex";
    } else if (pageInfoResult.statusCode == 0) {
      isIndexable = false;
      indexabilityStatus = pageInfoResult.statusText;
    } else if (pageInfoResult.statusCode >= 400) {
      isIndexable = false;
      indexabilityStatus = "Client Error";
    } else if (pageInfoResult.canonicalUrl &&
      decodeURI(pageInfoResult.canonicalUrl).toLowerCase() !== decodeURI(pageInfoResult.url).toLowerCase()) {
      isIndexable = false;
      indexabilityStatus = "Canonicalised";
    }

    return { isIndexable, indexabilityStatus };
  }

  async crawlPage(browser, singlePageLink) {
    const singlePageUrl = singlePageLink.url.toString();
    const userAgent = await browser.userAgent();
    const isAllowedByRobotsTxt = await this.isAllowedByRobotsTxt(singlePageUrl, userAgent);
    if (!isAllowedByRobotsTxt) {
      this.emit('info', `${singlePageUrl} is blocked by robots.txt`)
      return this.getRobotsBlockedResult(singlePageUrl, singlePageLink.depth);
    }

    const page = await browser.newPage();
    page.on('response', async (response) => {
      if (response.headers()['context-type'] && response.headers()['content-type'].includes("text/html")) {
        const isAllowedByRobotsTxt = await this.isAllowedByRobotsTxt(response.url(), userAgent);
        if (!isAllowedByRobotsTxt) {
          this.markItemAsProcessed(this.getRobotsBlockedResult(response.url(), singlePageLink.depth));
        } else {
          this.markResponseAsVisited(response, singlePageLink.depth);
        }
      }
    });

    this.emit('pageCrawlingStarted', { url: singlePageUrl, depth: singlePageLink.depth });
    const response = await page
      .goto(this.getNormalizedLink(singlePageLink.url), { waitUntil: 'domcontentloaded', timeout: 0 })
      .catch(error => {
        if (error.stack.includes('ERR_NAME_NOT_RESOLVED')) {
          return {
            url: () => singlePageUrl,
            status: () => 0,
            statusText: () => 'Invalid Link',
            headers: () => {return {'content-type': ''}}
          }
        }
      })

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

    await page.close().catch(e => {
      if (e.message.includes('Connection closed')) {
        return 0; // Either invalid request or a race condition 
      }
    });

    return {
      url: response.url(),
      response,
      extractedInfo,
      depth: singlePageLink.depth
    };
  }

  markResponseAsVisited(response, depth) {
    const responseUrl = new URL(response.url());
    const pageUrl = this.getNormalizedLink(responseUrl);
    if (!this.pagesProcessed.has(pageUrl)) {
      const resultItem = {
        url: pageUrl,
        statusCode: response.status(),
        statusText: response.statusText(),
        contentType: response.headers()['content-type'],
        isInternal: this.isInternalLink(responseUrl),
        depth
      };
      if ([301, 302].includes(response.status())) {
        resultItem.redirectUrl = response.headers()['location'];
        resultItem.indexability = false;
        resultItem.indexabilityStatus = 'Redirected';
      }
      this.markItemAsProcessed(resultItem);
    }
  }

  getRobotsBlockedResult(singlePageUrl, depth) {
    return {
      url: singlePageUrl,
      response: {
        url: () => singlePageUrl,
        status: () => 0,
        statusText: () => 'Blocked by robots.txt',
        headers: () => { return {}; }
      },
      depth
    };
  }

  async isAllowedByRobotsTxt(singlePageUrl, userAgent) {
    if (this.ignoreRobots) {
      return true;
    }
    return await this.robotsChecker.isAllowed(singlePageUrl, userAgent)
      .catch(ex => this.emit('error', `cannot evaluate robots.txt related to url: ${singlePageUrl}, exception: ${ex.toString()}`));
  }

  getNormalizedLink(currentPageUrl) {
    return currentPageUrl.href.replace(currentPageUrl.hash, '');
  }
}

module.exports = Arachnid;
