# Arachnid

A web crawler provides basic info for SEO purposes. 
The project build upon [Puppeteer](https://pptr.dev/) headless browser. 
The project implemented in PHP, [Arachnid PHP](https://github.com/zrashwani/arachnid), the idea of making NodeJS version that the machanism of event loop in Nodejs give us faster performance. 

### Features
1. Simple NodeJS application.
2. Crawl pages in variable depth provided by user.
3. Get basic information helps website owners & SEO specialists enhance thier site ranking. 
4. Event driven implemenation enable users of library to consume output in real-time

### Installing 

##### System Requirements
* NodeJS v10.0.0+

```sh
yarn add arachnid
```
or with npm:
```sh
npm install arachnid
```

### Usage 

##### Simple example
```js
    const Arachnid = require('arachnid');

    const arachnidObj = new Arachnid().setDomain('https://www.example.com');

    const crawlPage = await arachnidObj.traverse();
    console.log(crawlPage) // returns Map of crawled pages
    /**
     * 
     * Map(1) {
     *   'https://www.example.com/' => {
     *   pageUrl: 'https://www.example.com/',
     *   statusCode: 200,
     *   statusText: '',
     *   contentType: 'text/html; charset=UTF-8',
     *   depth: 1,
     *   url: 'https://www.example.com/',
     *   path: '/',
     *   title: 'Example Domain',
     *   h1: [ 'Example Domain' ],
     *   h2: [],
     *   meta: [],
     *   images: { broken: [], missingAlt: [] },
     *   canonicalUrl: ''
     *   }
     * }
     * /
```
##### Events example
```js
    const Arachnid = require('arachnid');

    const arachnid = new Arachnid().setDomain('https://www.example.com/').setConcurrency(5).setCrawlDepth(2);

    arachnid.on('results', resposne => console.log(response));
    arachnid.on('pageCrawlingSuccessed', pageResponse => processResponsePerPage(pageResponse));
    arachnid.on('pageCrawlingFailed', pageFailed => handleFailedCrwaling(pageFailed));
    // See https://github.com/WebExtractors/Arachnid#Events for full list of events emitted
```

[Full examples](https://github.com/WebExtractors/Arachnid/tree/master/examples)

### Events
|         Events        	|                    Description            	                |           Response            	|
|:---------------------:	|:---------------------------------------------------------:    |-------------------------------	|
|  pageCrawlingStarted  	|            Indicator of start crawling a page 	            |{url(String), depth(int)}   	    |
| pageCrawlingSuccessed 	|           Indicator of successful crawling page               |{url(String), statusCode(int)} 	|
|  pageCrawlingSkipped 	    | Indicator of skiping a page (if follow domains was disabled)	|{url(String), statusCode(int)} 	|
|   pageCrawlingFailed  	|            Indicator of failure crawling a page 	            |{url(String), statusCode(int)} 	|
|          info          	|             Informative generic message  	                    |(String)               	        |
|         results           |             Returns all collected data  	                    |Map(URL => {pageUrl(String), statusCode(int),statusText(String),contentType(String),depth(int),url(String),path(String),title(String),h1(Array(String)),h2(Array(String)), meta(Array(Object)), Images(Objecta):{broken(Array(String),missingAlt(Array(String))),canonicalUrl(String)}})             |


### Change log
We are still in Beta version :new_moon:

### Contributing 
Feel free to raise ticket under Issue tab or Submit PRs for enhancements. 

### Authors 
* Zeid Rashwani <http://zrashwani.com>
* Ahmad Khasawneh <https://github.com/AhmadKhasanweh>

### License
MIT Public License 
