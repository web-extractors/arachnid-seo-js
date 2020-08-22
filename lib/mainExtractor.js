'use strict'

const { findImages, addImageStatusCode } = require('./helper');

const extractor = async (page) => {
    const extractPromises = [];
    extractPromises.push(page.title());
    extractPromises.push(extractH(page, 1));
    extractPromises.push(extractH(page, 2));
    extractPromises.push(extractMeta(page));
    extractPromises.push(extractImages(page));
    extractPromises.push(extractCanonical(page));
  
    const mainInfo = await Promise.all(extractPromises);
    return {
        title: mainInfo[0],
        h1: mainInfo[1],
        h2: mainInfo[2],
        meta: mainInfo[3],
        images: mainInfo[4],
        canonicalUrl: mainInfo[5]
    };
}

const extractH = async (page, hNum) => {
    return new Promise(async (resolve, reject) => { 
        try {
            resolve(extractElemContents(page, `h${hNum}`)); 
        } catch (error) {
            reject(error);
        }
    }); 
};

const extractMeta = async (page) => { 
    return new Promise(async (resolve, reject) => {         
    resolve(page.evaluate(() => 
        Array.from(document.querySelectorAll('meta'))
            .filter(element => {
                const neededTags = ["title", "description", "keywords", "author"];
                return neededTags.includes(element.getAttribute("name"));
            }).map(element => {
                const attributeObject = {};
                element.getAttributeNames().forEach(name => {
                    attributeObject[name] = element.getAttribute(name);
                });
                return attributeObject;
            })
        ));
    });
};

const extractImages = async (page) => {
    return new Promise(async (resolve, reject) => {
        try {
            const imagesWithStatusCode = await addImageStatusCode(page, await findImages(page));
            const imagesBroken = imagesWithStatusCode
                .filter(image => image.statusCode > 399)
                .map(image => image.imageSource);
            const imagesWithoutAlt = imagesWithStatusCode
                .filter(image => image.imageAlternateText.length === 0)
                .map(image => image.imageSource);
            resolve({broken: imagesBroken, missingAlt: imagesWithoutAlt});
        } catch(ex) {
            reject({error: ex});
        }
      });
}  

const extractElemContents = async (page, elemSelector) => {
    return await page.evaluate(() => [...document.querySelectorAll('h1'/*elemSelector*/)].map(elem => elem.innerText));
}

const extractCanonical = async (page) => {
    return await page.evaluate(() => document.querySelector("link[rel='canonical']").getAttribute("href"));
}

module.exports = extractor;