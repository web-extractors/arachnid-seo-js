# Arachnid

An open-source library, web crawler provides basic info for SEO purposes, like Screaming Frog SEO Spider Tool.
The project build upon [Puppeteer](https://pptr.dev/) headless browser. 
The project implemented in PHP, [Arachnid PHP](https://github.com/zrashwani/arachnid), the idea of making NodeJS version that the machanism of event loop in Nodejs give us faster performance. 

## Features

1. Simple NodeJS application.
2. Crawl pages in variable depth provided by user.
3. Get basic information helps website owners & SEO specialists enhance their site ranking.
4. Event driven implemenation enable users of library to consume output in real-time.
5. Implements DFS(Depth First Search) algorithm, leads results in logical order.
6. parse meta tags: title, description, keywords, author & robots

### Getting Started

#### Installing

##### System Requirements

* NodeJS v10.0.0+

```sh
yarn add arachnid
```

or with npm:

```sh
npm install arachnid
```

#### Usage

#### Simple example

```js
    const Arachnid = require('arachnid');

    const arachnid = new Arachnid('https://www.example.com');

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

The library designed Builder pattern to construct flexible `Arachnid` variables, let's start exploring those options

##### Crawler Depth setter (Default = 1)

Set the crawling depth, which means how many pages `Arachnid` from main domain 
The higher value is the more more time it takes to complete

```js
    arachnid.setCrawlDepth(3);
```

##### Concurrency setter (Default = 1)

Set number of concurent operations to run in parralel

```js
    arachnid.setConcurrency(3);
```

##### Puppeteer Arguments setter (Default = [])

As method indicates, the library built on Puppeteer, which is `Additional arguments to pass to the browser instance`, [defaultArgs](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#puppeteerdefaultargsoptions) from Puppeteer documentation.

Sample below to run `Arachnid` on UNIX with no need to install extra dependencies

```js
    arachnid.setPuppeteerArgs([
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-sandbox',
        '--no-zygote',
        '--single-process'
    ]);
```

##### Follow Subdomains setter (Default = false)

Set flag to crawl subdomains e.g. `blog.example.com`

```js
    arachnid.shouldFollowSubdomains(true);
```

#### Events example

```js
    const Arachnid = require('arachnid');

    const arachnid = new Arachnid('https://www.example.com/').setConcurrency(5).setCrawlDepth(2);

    arachnid.on('results', resposne => console.log(response));
    arachnid.on('pageCrawlingSuccessed', pageResponse => processResponsePerPage(pageResponse));
    arachnid.on('pageCrawlingFailed', pageFailed => handleFailedCrwaling(pageFailed));
    // See https://github.com/WebExtractors/Arachnid#Events for full list of events emitted
```

[Full examples](https://github.com/WebExtractors/Arachnid/tree/master/examples)

### Events

|         Events         |                    Description                             |           Response             |
|:---------------------: |:---------------------------------------------------------:    |------------------------------- |
|  pageCrawlingStarted   |            Indicator of start crawling a page              |{url(String), depth(int)}        |
| pageCrawlingSuccessed  |           Indicator of successful crawling page               |{url(String), statusCode(int)}  |
|  pageCrawlingSkipped      | Indicator of skiping a page (if follow domains was disabled) |{url(String), statusCode(int)}  |
|   pageCrawlingFailed   |            Indicator of failure crawling a page              |{url(String), statusCode(int)}  |
|          info           |             Informative generic message                       |(String)                        |
|         results           |             Returns all collected data                       |Map(URL => {pageUrl(String), statusCode(int),statusText(String),contentType(String),depth(int),url(String),path(String),title(String),h1(Array(String)),h2(Array(String)), meta(Array(Object)), Images(Objecta):{broken(Array(String),missingAlt(Array(String))),canonicalUrl(String)}})             |

### Change log

We are still in Beta version :new_moon:

### Contributing

Feel free to raise ticket under Issue tab or Submit PRs for enhancements. 

### Authors

* Zeid Rashwani <http://zrashwani.com>
* Ahmad Khasawneh <https://github.com/AhmadKhasanweh>

### License

MIT Public License
