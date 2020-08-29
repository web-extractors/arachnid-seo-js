const request = require('./promiseRequest');

const findImages = async (page) => await page.evaluate(() => Array.from(document.images, image => {
  return {
    imageAlternateText: image.alt,
    imageSource: image.src,
  }
}));

const addImageStatusCode = async (some, images) => {
  return await Promise.all(images.map(async image => {
    const response = await request(image.imageSource);
    return {
      ...image,
      statusCode: response.statusCode,
    }
  }));
}

const addImageStatusCode2 = async (page, images) => {
  return await Promise.all(images.map(async image => {
    const response = await page.goto(image.imageSource, {waitUntil: 'domcontentloaded'});
    return {
      ...image,
      statusCode: response.status(),
    }
  }));
};

module.exports = { findImages, addImageStatusCode };
