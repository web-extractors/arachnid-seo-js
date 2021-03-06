# Arachnid-SEO

An open-source web crawler that extracts internal links info for SEO auditing & optimization purposes.
The project builds upon [Puppeteer](https://pptr.dev/) headless browser. Inspired by [Arachnid PHP](https://github.com/zrashwani/arachnid) library.

## Features

1. Simple NodeJS library with asynchronous crawling capability.
2. Crawl site pages controlled by maximum depth or maximum result count.
3. Implements BFS (Breadth First Search) algorithm, traversing pages ordered level by level.
4. Event driven implementation enables users of the library to consume output in real-time (crawling started/completed/skipped/failed ...etc.).
5. Extracting the following SEO-related information for each page in a site:
   * Page titles, main heading H1 and subheading H2 tag contents.
   * Page status code/text, enabling to detect broken links (4xx/5xx).
   * Meta tag information including: description, keywords, author, robots tags.
   * Detect broken image resources and images with missing alt attributes.
   * Extract page indexability status, and if page is not indexable detect the reason  (ex. blocked by robots.txt, client error, canonicalized)
   * Retrieve information about page resources (document/stylesheet/javascript/images files...etc requested by a page)
   * More SEO-oriented information will be added soon...

## Getting Started

### Installing

NodeJS v10.0.0+ is required.

```sh
npm install @web-extractors/arachnid-seo
```

### Basic Usage

```js
const Arachnid = require('@web-extractors/arachnid-seo').default;
const crawler = new Arachnid('https://www.example.com');
crawler.setCrawlDepth(2)
       .traverse()
       .then((results) => console.log(results)); //pages results
// or you can use in await/async manner: 
// const results = await crawler.traverse();       
```

results output:

```js
Map(3) {
  "https://www.example.com/" => {
    "url": "https://www.example.com/",
    "urlEncoded": "https://www.example.com/",
    "isInternal": true,
    "statusCode": 200,
    "statusText": "",
    "contentType": "text/html; charset=UTF-8",
    "depth": 1,
    "resourceInfo": [
      {
        "type": "document",
        "count": 1,
        "broken": []
      }
    ],
    "responseTimeMs": 340,
    "DOMInfo": {
      "title": "Example Domain",
      "h1": [
        "Example Domain"
      ],
      "h2": [],
      "meta": [],
      "images": {
        "missingAlt": []
      },
      "canonicalUrl": "",
      "uniqueOutLinks": 1
    },
    "isIndexable": true,
    "indexabilityStatus": ""
  },
  "https://www.iana.org/domains/example" => {
    "url": "https://www.iana.org/domains/example",
    "urlEncoded": "https://www.iana.org/domains/example",
    "statusCode": 301,
    "statusText": "",
    "contentType": "text/html; charset=iso-8859-1",
    "isInternal": false,
    "robotsHeader": null,
    "depth": 2,
    "redirectUrl": "https://www.iana.org/domains/reserved",
    "isIndexable": false,
    "indexabilityStatus": "Redirected"
  },
  "https://www.iana.org/domains/reserved" => {
    "url": "https://www.iana.org/domains/reserved",
    "urlEncoded": "https://www.iana.org/domains/reserved",
    "isInternal": false,
    "statusCode": 200,
    "statusText": "",
    "contentType": "text/html; charset=UTF-8",
    "depth": 2,
    "isIndexable": true,
    "indexabilityStatus": ""
  }
}
```

## Advanced Usage

The library designed using Builder pattern to construct flexible `Arachnid-SEO` crawling variables, as following:

### Method chain

#### Setting maximum depth

To specify maximum links depth to crawl, `setCrawlDepth` method can be used:

> `depth` equal 1 would be used by default, if `CrawlDepth` is not set nor `MaxResultsNum`.

```js
cralwer.setCrawlDepth(3);
```

#### Setting maximum results number

To specify the maximum results to be crawled, `setMaxResultsNum` method can be used:

> `setMaxResultsNum` overwrites `setCrawlDepth` when both methods are used.

```js
cralwer.setMaxResultsNum(100);
```

#### Setting number of concurrent requests

To improve the speed of the crawl the package concurrently crawls 5 urls by default,
to change that concurrency value, `setConcurrency` method can be used:

> That will modify the number of pages/tabs created by puppeteer at the same time, increasing it to a large number may cause some memory impact.

```js
cralwer.setConcurrency(10);
```

#### Setting Puppeteer Launch Options

To pass additional arguments to puppeteer browser instance, `setPuppeteerOptions` method can be used:

> Refer to puppeteeer documentation for more information about [options](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#puppeteerlaunchoptions).

Sample below to run `Arachnid-SEO` on UNIX with no need to install extra dependencies:

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

Arachnid-SEO provides methods to track crawling activity progress, by emitting various events as below:

#### Events example

```js
const Arachnid = require('@web-extractors/arachnid-seo').default;
const crawler = new Arachnid('https://www.example.com/')
                        .setConcurrency(5)
                        .setCrawlDepth(2);

crawler.on('results', response => console.log(response))
       .on('pageCrawlingSuccessed', pageResponse => processResponsePerPage(pageResponse))
       .on('pageCrawlingFailed', pageFailed => handleFailedCrwaling(pageFailed));
       // See https://github.com/web-extractors/arachnid-seo-js#using-events for full list of events emitted

crawler.traverse();
```

See [Full examples](https://github.com/web-extractors/arachnid-seo-js/tree/master/examples) for full list of events emitted.

#### List of events

##### event: 'info'

* Emitted when a general activity takes place like: getting the next page batch to process.
* Payload: <InformativeMessage(String)>

##### event: 'error'

* Emitted when an error occurs while processing a link or batch of links, ex. URL with invalid hostname.
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

* Emitted when the page url marked as processed after extracting all information and adding it to thr results map.
* Payload:  <{url(String), [ResultInfo](https://github.com/web-extractors/arachnid-seo-js/blob/203a9249759f1124f74169aae19546819772135f/src/types/arachnid.d.ts#L15-L29)}>

##### event: 'pageCrawlingSkipped'

* Emitted when crawling or extracting page info skipped due to non-html content, invalid or external link.
* Payload:  <{url(String), reason(String)}>  

##### event: 'results'

* Emitted when crawling all links matching parameters completed and returning all links information.
* Payload:  <Map<{url(String), [ResultInfo](https://github.com/web-extractors/arachnid-seo-js/blob/203a9249759f1124f74169aae19546819772135f/src/types/arachnid.d.ts#L15-L29)}>>  

## Changelog

We are still in Beta version :new_moon:

## Contributing

Feel free to raise a ticket under Issue tab or Submit PRs for any new bug fix/feature/enhancement.

## Authors

* Zeid Rashwani <http://zrashwani.com>
* Ahmad Khasawneh <https://github.com/AhmadKhasanweh>

### License

MIT Public License
