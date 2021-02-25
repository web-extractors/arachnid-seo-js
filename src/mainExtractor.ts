import { Page } from 'puppeteer';
import { ExtractedInfo, ImageInfo } from './types/mainExtractor';

export const extractor = async (page: Page): Promise<ExtractedInfo> => {
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
        uniqueOutLinks: mainInfo[6].length
    };
};

const extractSelectorContents = async (page: Page, selector: string): Promise<string[]> => {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(extractElemContents(page, selector));
        } catch (error) {
            reject({ errorInfo: error.message });
        }
    });
};

const extractMeta = async (page: Page): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(
                page.evaluate(() =>
                    [...document.querySelectorAll('meta')]
                        .filter((element) => {
                            const metaTags = ['title', 'description', 'keywords', 'author', 'robots'];
                            return metaTags.includes(element.getAttribute('name') ?? '');
                        })
                        .map((element) => {
                            return { [element.getAttribute('name')!]: element.getAttribute('content') };
                        }),
                ),
            );
        } catch (ex) {
            reject(ex);
        }
    });
};

const extractImages = async (page: Page): Promise<ImageInfo> => {
    return new Promise<ImageInfo>(async (resolve, reject) => {
        try {
            const missingAltImages: string[] = await page.evaluate(() =>
                Array.from(document.images, (image: HTMLImageElement) => {
                    return {
                        imageAlternateText: image.alt,
                        imageSource: image.src,
                    };
                })
                    .filter((item) => item.imageAlternateText.length === 0)
                    .map((image) => image.imageSource),
            );
            resolve({ missingAlt: [...new Set(missingAltImages)] });
        } catch (ex) {
            reject({ error: ex });
        }
    });
};

const extractElemContents = async (page: Page, elemSelector: string): Promise<string[]> =>
    await page.evaluate(
        (selector: string) =>
            [...document.querySelectorAll(selector)].map((elem) =>
                elem.textContent !== null ? elem.textContent.trim() : '',
            ),
        elemSelector,
    );

const extractCanonical = async (page: Page): Promise<string> =>
    await page.evaluate(() => document.querySelector("link[rel='canonical']")?.getAttribute('href') ?? '');

const extractLinks = async (page: Page, baseUrl: string): Promise<(URL | string)[]> => {
    const links: string[] = await page.evaluate(
        () =>
            [...document.querySelectorAll('a')]
                .filter((elem) => elem.getAttribute('rel') !== 'nofollow')
                .filter((elem) => elem.getAttribute('href'))
                .map((elem) => elem.getAttribute('href'))
                .filter((link) => {
                    const stopRegexList = [
                        /^javascript\:.*$/g,
                        /^mailto\:.*$/g,
                        /^tel\:.*$/g,
                        /^skype\:.*$/g,
                        /^fax\:.*$/g,
                    ];
                    return !stopRegexList.some((regex) => link!.match(regex));
                })
                .filter((currentLink) => {
                    if (currentLink?.includes('#')) {
                        currentLink = currentLink.substring(0, currentLink.indexOf('#'));
                    }
                    return currentLink;
                }) as string[],
    );
    return [...new Set(links)]
        .map((link) => {
            try {
                return new URL(link, baseUrl).toString();
            } catch (e) {
                return link;
            }
        })
        .filter((url) => url !== page.url());
};
