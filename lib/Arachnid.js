'use strict'

const puppeteer = require('puppeteer');
const { findImages, addImageStatusCode, divElements } = require('./helper');

const Arachnid = async (domain) => {
  const browser = await puppeteer.launch({ headless: true});
  const page = await browser.newPage();
  const response = await page.goto(domain, {waitUntil: 'domcontentloaded'});

  const title = await page.title();
  const h1Elements = await page.evaluate(() => Array.from(document.querySelectorAll('h1'), element => element.textContent));

  const dimensions = await page.evaluate(() => {
      return {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      };
    });

  const metadata = await page.evaluate(() => Array.from(document.querySelectorAll('meta'))
    .map(element => {
      const attributeObject = {};
      element.getAttributeNames().forEach(name => {
        attributeObject[name] = element.getAttribute(name);
      })
      return attributeObject;
    })
  );
  
  const images = await findImages(page);

  const imagesWithStatusCode = await addImageStatusCode(page, images);

  const output = {
      width: dimensions.width,
      height: dimensions.height,
      title,
      h1: {
          count: h1Elements.length, 
          elements: h1Elements
      },
      statusCode: response.status(),
      statusText: response.statusText(),
      contentType: response.headers()['content-type'],
      metadata,
      images,
      imagesWithStatusCode,
      divs: await divElements(page),
      htmlBody: await htmlBody(page)
  }

  await browser.close();

  return output;
};


module.exports = Arachnid;
