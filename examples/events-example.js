const Arachnid = require('../lib/Arachnid');

const arachnid = new Arachnid().setDomain('https://www.google.com/').setConcurrency(5).setCrawlDepth(2)
arachnid.traverse()
arachnid.on('info', res => console.log('info events', res))
arachnid.on('results', res => console.log('results event', res))
arachnid.on('pageCrawlingStarted', res => console.log('pageCrawlingStarted events', res))
arachnid.on('pageResponseReceived', res => console.log('pageResponseReceived events', res))
arachnid.on('pageCrawlingFinished', res => console.log('pageCrawlingFinished events', res))
