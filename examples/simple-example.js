const Arachnid = require('@web-extractors/arachnid-seo').default;

async function crawl(domain, depth, concurrency) {
    const startTime = Date.now();
    const arachnidObj = new Arachnid(domain)
        .setConcurrency(concurrency)
        .setCrawlDepth(depth)
        .shouldFollowSubdomains(true)
        .setPuppeteerOptions({
            args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-sandbox',
            '--no-zygote',
            '--single-process',
        ]})
    const results = await arachnidObj.traverse();

    const endTime = Date.now();
    console.log(JSON.stringify([...results], null, 4)); 
    console.log("It took: " + (endTime - startTime) + " milliseconds");
    console.log(`Found ${results.size} results with depth=${depth} concurrency=${concurrency}`);
}

crawl("https://www.example.com/", 2, 5);
