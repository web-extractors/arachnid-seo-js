'use strict';

import { findImages, addImageStatusCode } from './helper';

const extractor = async (page: { url: () => string; title: () => any }) => {
  const currentUrl = new URL(page.url());
  const extractPromises = [];
  extractPromises.push(page.title());
  extractPromises.push(extractSelectorContents(page, 'h1'));
  extractPromises.push(extractSelectorContents(page, 'h2'));
  extractPromises.push(extractMeta(page));
  extractPromises.push(extractImages(page));
  extractPromises.push(extractCanonical(page));
  extractPromises.push(extractLinks(page, currentUrl.toString()));

  const mainInfo = await Promise.all(extractPromises);
  return {
    title: mainInfo[0],
    h1: mainInfo[1],
    h2: mainInfo[2],
    meta: mainInfo[3],
    images: mainInfo[4],
    canonicalUrl: mainInfo[5],
    links: mainInfo[6],
  };
};

const extractSelectorContents = async (page: { url: () => string; title: () => any }, selector: string) => {
  return new Promise(async (resolve, reject) => {
    try {
      resolve(extractElemContents(page, selector));
    } catch (error) {
      reject({ errorInfo: error.message });
    }
  });
};

const extractMeta = async (page: { url?: () => string; title?: () => any; evaluate?: any }) => {
  return new Promise(async (resolve, reject) => {
    try {
      resolve(
        page.evaluate(() =>
          Array.from(document.querySelectorAll('meta'))
            .filter((element) => {
              const neededTags = ['title', 'description', 'keywords', 'author'];
              const elementNameAttribute = element.getAttribute('name') || '';
              return neededTags.includes(elementNameAttribute);
            })
            .map((element) => {
              return { name: element.getAttribute('name'), content: element.getAttribute('content') };
            }),
        ),
      );
    } catch (ex) {
      reject(ex);
    }
  });
};

const extractImages = async (page: { url: () => string; title: () => any }) => {
  return new Promise(async (resolve, reject) => {
    try {
      const imagesWithStatusCode = await addImageStatusCode(page, await findImages(page));
      const imagesBroken = imagesWithStatusCode
        .filter((image: any) => image.statusCode > 399)
        .map((image: any) => image.imageSource);
      const imagesWithoutAlt = imagesWithStatusCode
        .filter((image: any) => image.imageAlternateText!.length === 0)
        .map((image: any) => image.imageSource);
      resolve({ broken: imagesBroken, missingAlt: imagesWithoutAlt });
    } catch (ex) {
      reject({ error: ex });
    }
  });
};

const extractElemContents = async (page: any, elemSelector: string) => {
  return await page.evaluate(
    (selector: any) => Array.from(document.querySelectorAll(selector)).map((elem) => elem.innerText),
    elemSelector,
  );
};

const extractCanonical = async (page: { url?: () => string; title?: () => any; evaluate?: any }) => {
  return await page.evaluate(() => {
    const canonicalLinkElem = document.querySelector("link[rel='canonical']");
    return canonicalLinkElem != null ? canonicalLinkElem.getAttribute('href') : '';
  });
};

const extractLinks = async (page: any, baseUrl: string) => {
  const links: T[] = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .filter((elem) => elem.getAttribute('rel') !== 'nofollow')
      .map((elem) => elem.getAttribute('href'))
      .filter(Boolean) // filter null values
      .filter((link) => {
        const stopRegexList = [/^javascript\:.*$/g, /^mailto\:.*$/g, /^tel\:.*$/g, /^skype\:.*$/g, /^fax\:.*$/g];
        return !stopRegexList.some((regex) => link!.match(regex));
      })
      .filter((currentLink) => {
        if (currentLink!.includes('#')) {
          currentLink = currentLink!.substring(0, currentLink!.indexOf('#'));
        }
        return currentLink!.length > 0;
      }),
  );
  return [...new Set(links)].map((link) => new URL(link, baseUrl).toString());
};

export default extractor;
