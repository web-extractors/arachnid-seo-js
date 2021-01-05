const Arachnid = require('../lib/Arachnid').default;

const domain = 'https://www.example.com/';
const arachnid = new Arachnid(domain).setConcurrency(5).setCrawlDepth(2);

arachnid.on('results', response => { // returns Map object url: {statusCode, metadata, h1, h2 etc...}
            console.log('Results received: ', response);
        })
        .on('info', response => console.log('INFO:', response))
        .on('error', err => console.log('ERROR:', err))
        .on('pageCrawlingStarted', response => console.log('page crawling started: ', response.url))
        .on('pageCrawlingFinished', response => console.log('page crawling finished: ', response))
        .on('pageCrawlingFailed', response => console.log('page crawling failed:', response))
        .on('pageCrawlingSuccessed', response => console.log('page crawling success:', response))
        .on('pageCrawlingSkipped', response => console.log('page crawling skipped:', response));

arachnid.traverse();
