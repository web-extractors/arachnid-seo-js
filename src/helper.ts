export const findImages = async (page: any) =>
  await page.evaluate(() =>
    Array.from(document.images, (image) => {
      return {
        imageAlternateText: image.alt,
        imageSource: image.src,
      };
    }),
  );

const imageCache = new Map();
export const addImageStatusCode = async (page: any, images: any) => {
  return await Promise.all(
    images.map(async (image: any) => {
      const cacheKey = image.imageSource;
      if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey);
      }
      const newPage = await page.browser().newPage();
      const response = await newPage.goto(image.imageSource, { waitUntil: 'domcontentloaded' });
      const result = {
        ...image,
        statusCode: response.status(),
      };
      newPage.close();
      imageCache.set(cacheKey, result);
      return result;
    }),
  );
};
