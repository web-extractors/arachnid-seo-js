const { EVENT_LINK_CRAWLING_FINISHED } = require('./lib/Arachnid');
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
    getCurrentDate = () => {
        const currDate = new Date();
        const time = currDate.getHours()+":"+currDate.getMinutes()+":"+currDate.getSeconds();
        return time;
    }
    let countLink = 0;
    arachnidObj.on(Arachnid.EVENT_LINK_CRAWLING_STARTED, (link) => {
        console.log(`[${getCurrentDate()}] starting crawling link ${JSON.stringify(link)}`);
    });
    arachnidObj.on(Arachnid.EVENT_LINK_CRAWLING_FINISHED, (data) => {
        countLink++;
        console.log(`[${getCurrentDate()}] (${countLink}) finished crawling crawled data`, data.url);
    });
    arachnidObj.on(Arachnid.EVENT_LINK_CRAWLING_SKIPPED, (data) => {
        console.log(`[${getCurrentDate()}] skipping crawling ${JSON.stringify(data.link)}, reason: ${data.reason}`);
    });
    const results = await arachnidObj.traverse();

    const endTime = Date.now();
    console.log(JSON.stringify([...results], null, 4)); 
    console.log("It took: " + (endTime - startTime) + " milliseconds");
    console.log(`Found ${results.size} results with depth=${depth} concurrency=${concurrency}`);
}

crawl("http://zrashwani.com", 3, 5);