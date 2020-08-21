'use strict'

const { findImages, addImageStatusCode } = require('./helper');

const extractor = async (page) => {
    const titlePromise = page.title();
    const h1Promises = extractH(page, 1);
    const h2Promises = extractH(page, 2);
    const metadataPromise = extractMeta(page);
    const imagesPromise = extractImages(page);
  
    const mainInfo = await Promise.all([titlePromise, h1Promises, h2Promises, metadataPromise, imagesPromise]);
    return {
        title: mainInfo[0],
        h1: mainInfo[1],
        h2: mainInfo[2],
        meta: mainInfo[3],
        images: mainInfo[4]
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
            const images = await findImages(page);
            const imagesWithStatusCode = await addImageStatusCode(page, images);
            resolve(imagesWithStatusCode);
        } catch(ex) {
            reject({error: ex});
        }
      });
}  

const extractElemContents = async (page, elemSelector) => {
    return await page.evaluate(() => [...document.querySelectorAll('h1'/*elemSelector*/)].map(elem => elem.innerText));
}

module.exports = extractor;