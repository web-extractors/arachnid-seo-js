'use strict'

const puppeteer = require('puppeteer');
const mainExtractor = require('./mainExtractor');
const Queue = require('queue-fifo');

const crawlPage = async (browser, domain) => {
  const page = await browser.newPage();
  const response = await page.goto(domain, {waitUntil: 'domcontentloaded', timeout:0});
  const extractedInfo = await mainExtractor(page);

  return {
    response,
    extractedInfo
  }
}

const Arachnid = async (domain, maxDepth = 1, args) => {
  const browser = await puppeteer.launch({headless: true, args});
  const mainPageUrl = new URL(domain);
  const pagesToVisitQ = new Queue();
  const pagesProcessed = new Map();
  pagesToVisitQ.enqueue({url: mainPageUrl, depth: maxDepth});
  while(!pagesToVisitQ.isEmpty()) {
      const currentPage = pagesToVisitQ.dequeue();
      const currentPageUrl = currentPage.url;
      const normalizedUrl = `${currentPageUrl.host}${currentPageUrl.pathname}${currentPageUrl.search}`;
      console.log(`normalized Url ${normalizedUrl}`);
      if(pagesProcessed.has(normalizedUrl)) {
        continue;
      }
      //TODO: amend the condition to take into account subdomain links
      //TODO: check that pages are non-broken only if external and add to the results map
      if(currentPageUrl.host !== mainPageUrl.host) { 
        console.log(`skipping ${currentPageUrl.toString()} as its external link`);
        continue;
      }
      console.log(`Traversing: ${JSON.stringify(currentPage)}`);;
      const {response, extractedInfo} = await crawlPage(browser, currentPage.url);
      if(currentPage.depth < maxDepth) {
        extractedInfo.links.forEach(link => {
            pagesToVisitQ.enqueue({url: new URL(link), depth: currentPage.depth+1});
        });
      } else {
        //TODO: reached max depth, we should just validate the links are non-broken 200 status code
      }
      delete extractedInfo.links; 
      const pageInfoResult = {
        statusCode: response.status(),
        statusText: response.statusText(),
        contentType: response.headers()['content-type'],
        depth: currentPage.depth,
        ...extractedInfo,
      };
     
      pagesProcessed.set(normalizedUrl, pageInfoResult);
  }

  await browser.close();

  return pagesProcessed;
};


module.exports = Arachnid;
