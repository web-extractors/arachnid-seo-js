'use strict'

const { findImages, addImageStatusCode } = require('./helper');

const extractor = async (page) => {
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
        url:  currentUrl.toString(),
        path: currentUrl.pathname,
        title: mainInfo[0],
        h1: mainInfo[1],
        h2: mainInfo[2],
        meta: mainInfo[3],
        images: mainInfo[4],
        canonicalUrl: mainInfo[5],
        links: mainInfo[6],
    };
}

const extractSelectorContents = async (page, selector) => {
    return new Promise(async (resolve, reject) => { 
        try {
            resolve(extractElemContents(page, selector)); 
        } catch (error) {
            resolve({errorInfo: error.message});
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
                return {name: element.getAttribute("name"), content: element.getAttribute("content")};
            })
        ));
    });
};

const extractImages = async (page) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.time();
            const imagesWithStatusCode = await addImageStatusCode(page, await findImages(page));
            console.log('logging time addImageStatusCode using node native http request')
            console.timeEnd();
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
    return await page.evaluate((selector) => 
        [...document.querySelectorAll(selector)].map(elem => elem.innerText), 
        elemSelector);
}

const extractCanonical = async (page) => {
    return await page.evaluate(() => { 
        const canonicalLinkElem = document.querySelector("link[rel='canonical']");
        return canonicalLinkElem != null ? canonicalLinkElem.getAttribute("href"): ""; 
    });
}

const extractLinks = async (page, baseUrl) => {
    const links = await page.evaluate(() => [...document.querySelectorAll('a')]
                        .map(elem => elem.getAttribute('href'))
                        .filter(link => {
                                if (link === null) {
                                    return false;
                                }
                                let currentLink = link;
                                const stopRegexList = [
                                    /^javascript\:.*$/g,
                                    /^mailto\:.*$/g,
                                    /^tel\:.*$/g,
                                    /^skype\:.*$/g,
                                    /^fax\:.*$/g,
                                ];                            
                                for(let i=0; i < stopRegexList.length; i++) {                                    
                                    if (link.match(stopRegexList[i]) != null) {
                                        return false;
                                    }
                                }                            
                                if (currentLink.includes("#")) {
                                    currentLink = currentLink.substring(0, currentLink.indexOf("#"));
                                }                        
                                return currentLink.length > 0;                            
                        }));
    return [...new Set(links)].map(link => (new URL(link, baseUrl).toString()));                    
}

module.exports = extractor;
