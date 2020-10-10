const Arachnid = require('./lib/Arachnid');

async function crawl(domain, depth, concurrency) {
    const startTime = Date.now();
    const arachnidObj = new Arachnid(domain, depth, concurrency, [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-sandbox',
        '--no-zygote',
        '--single-process',
    ]);
    const results = await arachnidObj.traverse();

    const endTime = Date.now();
    console.log(JSON.stringify([...results], null, 4)); 
    console.log("It took: " + (endTime - startTime) + " milliseconds");
    console.log(`Found ${results.size} results with depth=${depth} concurrency=${concurrency}`);
}

crawl("https://laravel-news.com/", 2, 5);