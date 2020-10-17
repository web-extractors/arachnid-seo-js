const Arachnid = require('../lib/Arachnid');

const domain = 'https://www.example.com/';
const arachnid = new Arachnid().setDomain(domain).setConcurrency(5).setCrawlDepth(2);

arachnid.on('info', response => console.log('info events', response));
arachnid.on('results', response => { // returns Map object url: {statusCode, metadata, h1, h2 etc...}
    console.log('results event'); 
    for (let [key, value] of response) {
        console.log(key + ' : ' + value.valueOf());
    }
});
arachnid.on('pageCrawlingStarted', response => {
    console.log('pageCrawlingStarted events');
    console.log(response.url);
});
arachnid.on('pageCrawlingFinished', response => {
    console.log('pageCrawlingFinished events');
    console.log(response.url);
    console.log(response.statusCode);
});
arachnid.on('pageCrawlingFailed', response => {
    console.log('pageCrawlingFailed events');
    console.log(response.url, response.statusCode);
});

arachnid.traverse();