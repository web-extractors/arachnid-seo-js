import { Page } from 'puppeteer';
import { ImageElementAttributes, ImageElementAttributesWithStatusCode } from './types/helper';

export const findImages = async (page: Page): Promise<ImageElementAttributes[]> => await page.evaluate(() => Array.from(document.images, (image: HTMLImageElement) => {
    return {
      imageAlternateText: image.alt,
      imageSource: image.src,
    };
  })
);

const imageCache = new Map();
export const addImageStatusCode = async (page: Page, images: ImageElementAttributes[]): Promise<ImageElementAttributesWithStatusCode[]> => await Promise.all(
  images.map(async (image: ImageElementAttributes) => {
    const cacheKey = image.imageSource;
    if (imageCache.has(cacheKey)) {
      return imageCache.get(cacheKey);
    }
    const newPage = await page.browser().newPage();
    const response = await newPage.goto(image.imageSource, { waitUntil: 'domcontentloaded' });
    const result = {
      ...image,
      statusCode: response !== null ? response.status(): 0,
    };
    newPage.close();
    imageCache.set(cacheKey, result);
    return result;
  })
);
