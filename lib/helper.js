const findImages = async (page) => await page.evaluate(() => Array.from(document.images, image => {
  return {
    imageAlternateText: image.alt,
    imageSource: image.src,
  }
}));


module.exports = { findImages };
