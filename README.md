# Arachnid

A web crawler provides basic info for SEO purposes. 
The project build upon [Puppeteer](https://pptr.dev/) headless browser. 

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

More [advanced examples](https://github.com/WebExtractors/Arachnid/tree/master/examples)

### API 
Please read [`API`](API.md) for details

### Change log
We are still in Beta version :new_moon:

### Contributing 
Feel free to raise ticket under Issue tab or Submit PRs for enhancements. 

### Authors 
* Zeid Rashwani <http://zrashwani.com>
* Ahmad Khasawneh <https://github.com/AhmadKhasanweh>

### License
MIT Public License 
