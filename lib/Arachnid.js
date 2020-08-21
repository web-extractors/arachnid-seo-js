'use strict'

const puppeteer = require('puppeteer');
const mainExtractor = require('./mainExtractor');

const Arachnid = async (domain) => {
  const browser = await puppeteer.launch({ headless: true});
  const page = await browser.newPage();
  const response = await page.goto(domain, {waitUntil: 'domcontentloaded'});
  const extractedInfo = await mainExtractor(page);

  const output = {
      statusCode: response.status(),
      statusText: response.statusText(),
      contentType: response.headers()['content-type'],
      ...extractedInfo
  };

  await browser.close();

  return output;
};


module.exports = Arachnid;
