# Arachnid

An open-source web crawler that extracts internal links info for SEO auditing & optimization purposes.
The project build upon [Puppeteer](https://pptr.dev/) headless browser. Inspired by [Arachnid PHP](https://github.com/zrashwani/arachnid) library.

## Features

1. Simple NodeJS library with asynchronous crawling capability.
2. Crawl site pages controlled by maximum depth or maximum result count.
3. Implements BFS (Breadth First Search) algorithm, traversing pages ordered level by level.
4. Event driven implementation enable users of library to consume output in real-time (crawling started/completed/skipped/failed ...etc.).
5. Extracting the following SEO-related information for each page in a site: 
   * Page titles, main heading H1 and sub heading H2 tag contents.
   * Page status code/text, enabling to detect broken links (4xx/5xx).
   * Meta tag information including: description, keywords, author, robots tags.
   * Detect broken image resources and images with missing alt attribute.
   * Extract page indexability status, and if page is not indexable detect the reason  (ex. blocked by robots.txt, client error, canonicalized)
   * More SEO-oriented information will be added soon...

## Getting Started

### Installing

NodeJS v10.0.0+ is required.

```sh
npm install arachnid
```

### Basic Usage

```js
const Arachnid = require('arachnid');
const cralwer = new Arachnid('https://www.example.com');

const results = await cralwer
                        .setCrawlDepth(2)
                        .traverse();
console.log(results) // returns Map of crawled pages
```

results output:

```js
Map(3) {
  'https://www.example.com/' => {
    url: 'https://www.example.com/',
    isInternal: true,
    statusCode: 200,
    statusText: '',
    contentType: 'text/html; charset=UTF-8',
    robotsHeader: undefined,
    depth: 1,
    linksCount: 1,
    title: 'Example Domain',
    h1: [ 'Example Domain' ],
    h2: [],
    meta: [],
    images: { broken: [], missingAlt: [] },
    canonicalUrl: '',
    indexability: true,
    indexabilityStatus: ''
  },
  'https://www.iana.org/domains/example' => {
    url: 'https://www.iana.org/domains/example',
    statusCode: 301,
    statusText: '',
    contentType: 'text/html; charset=iso-8859-1',
    isInternal: false,
    depth: 2,
    redirectUrl: 'https://www.iana.org/domains/reserved',
    indexability: false,
    indexabilityStatus: 'Redirected'
  },
  'https://www.iana.org/domains/reserved' => {
    url: 'https://www.iana.org/domains/reserved',
    isInternal: false,
    statusCode: 200,
    statusText: '',
    contentType: 'text/html; charset=UTF-8',
    robotsHeader: undefined,
    depth: 2,
    indexability: true,
    indexabilityStatus: ''
  }
}
```

## Advanced Usage

The library designed using Builder pattern to construct flexible `Arachnid` crawling variables, as following:

### Method chain

#### Setting maximum depth

To specify maximum links depth to crawl, `setCrawlDepth` method can be used:

> `depth` equal 1 would be used by default, if `CrawlDepth` is not set nor `MaxResultsNum`.

```js
cralwer.setCrawlDepth(3);
```

#### Setting maximum results number

To specify the maximum results to be crawled, `setMaxResultsNum` method can be used:

```js
cralwer.setMaxResultsNum(100);
```

#### Setting number of concurrent requests

To improve the speed of the crawl the package concurrently crawls 5 urls by default,
to change that concurrency value, `setConcurrency` method can be used:

> That will modify number of pages/tabs created by puppeteer at the same time, increasing it to large number may cause some memory impact.

```js
cralwer.setConcurrency(10);
```

#### Setting Puppeteer Launch Options

To pass additional arguments to puppeteer browser instance, `setPuppeteerOptions` method can be used:

> Refer to puppeteeer documentation for more information about [options](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#puppeteerlaunchoptions).

Sample below to run `Arachnid` on UNIX with no need to install extra dependencies:

```js
  cralwer.setPuppeteerOptions({
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-sandbox',
        '--no-zygote',
        '--single-process'
    ]
  });
```

#### Enable following subdomains links

By default, only crawling and extracting information of internal links with the same domain is enabled.
To enable following subdomain links, `shouldFollowSubdomains` method can be used:

```js
cralwer.shouldFollowSubdomains(true);
```

#### Ignoring Robots.txt rules

By default, the crawler will respect robots.txt allow/disallow results, to ignore robots rules, `ignoreRobots` method can be used:

```js
cralwer.ignoreRobots();
```

### Using Events

Arachnid provides methods to track crawling activity progress, by emitting various events as below:

#### Events example

```js
const Arachnid = require('arachnid');
const crawler = new Arachnid('https://www.example.com/').setConcurrency(5).setCrawlDepth(2);

crawler.on('results', resposne => console.log(response))
       .on('pageCrawlingSuccessed', pageResponse => processResponsePerPage(pageResponse))
       .on('pageCrawlingFailed', pageFailed => handleFailedCrwaling(pageFailed));
       // See https://github.com/WebExtractors/Arachnid#Events for full list of events emitted
```

See [Full examples](https://github.com/WebExtractors/Arachnid/tree/master/examples) for full list of events emitted.

#### List of events

##### event: 'info'

* Emitted when a general activity take place like: getting next page batch to process.
* Payload: <InformativeMessage(String)>

##### event: 'error'

* Emitted when an error occurs while processing link or batch of links, ex. URL with invalid hostname.
* Payload: <ErrorMessage(String)>
  
##### event: 'pageCrawlingStarted'

* Emitted when crawling of a page start (puppeteer open tab for page URL).
* Payload:  <{url(String), depth(int)}>

##### event: 'pageCrawlingSuccessed'

* Emitted when a success response received for Url (2xx/3xx).
* Payload:  <{url(String), statusCode(int)}>  

##### event: 'pageCrawlingFailed'

* Emitted when a failure response received for Url (4xx/5xx).
* Payload:  <{url(String), statusCode(int)}>

##### event: 'pageCrawlingFinished'

* Emitted when page url marked as processed after extracting all information and adding it to results map.
* Payload:  <{url(String), PageResultInfo}>

##### event: 'pageCrawlingSkipped'

* Emitted when crawling or extracting page info skipped due to non-html content, invalid or external link.
* Payload:  <{url(String), reason(String)}>  

##### event: 'results'

* Emitted when crawling all links matching parameters completed and return all links information.
* Payload:  <Map<{url(String), PageResultInfo}>>  

## Changelog

We are still in Beta version :new_moon:

## Contributing

Feel free to raise ticket under Issue tab or Submit PRs for any new bug fix/feature/enhancement. 

## Authors

* Zeid Rashwani <http://zrashwani.com>
* Ahmad Khasawneh <https://github.com/AhmadKhasanweh>

### License

MIT Public License
