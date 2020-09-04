'use strict'

const puppeteer = require('puppeteer');
const mainExtractor = require('./mainExtractor');

const constructor = async (browser, domain, goNext) => {
  const page = await browser.newPage();
  const response = await page.goto(domain, {waitUntil: 'domcontentloaded', timeout:0});
  const extractedInfo = await mainExtractor(page, goNext);

  return {
    response,
    extractedInfo
  }
}

const Arachnid = async (domain) => {
  const browser = await puppeteer.launch({headless: true});

  const {response, extractedInfo} = await constructor(browser, domain, true);

  const nestedLinks = await Promise.all(extractedInfo.links.map(async (link) => {
    const {response, extractedInfo} = await constructor(browser, link, false)
    return {
      statusCode: response.status(),
      statusText: response.statusText(),
      contentType: response.headers()['content-type'],
      ...extractedInfo,
    }
  }));

  const output = {
      statusCode: response.status(),
      statusText: response.statusText(),
      contentType: response.headers()['content-type'],
      ...extractedInfo,
      nestedLinks
  };

  await browser.close();

  return output;
};


module.exports = Arachnid;
