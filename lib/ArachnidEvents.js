const events = require('events')
const puppeteer = require('puppeteer')
const Queue = require('queue-fifo')
const arachnidBuidler = require('./ArachnidBuilder')
const mainExtractor = require('./mainExtractor')

class Arachnid2 extends events {
    constructor(arachnidObject) {
        super()
        this.arachnidObject = arachnidObject
        this.response = {}
        this.pagesToVisitQ = new Queue()
        this.pagesProcessed = new Map()
    }

    async traverse() {
        const browser = await puppeteer.launch({ headless: true })
        this.pagesToVisitQ.enqueue({ url: this.arachnidObject.domain, depth: 1 })
        while (!this.pagesToVisitQ.isEmpty()) {
          const urlsToProcess = this.getNextPageBatch()
          const pagesInfoResult = await this.processPageBatch(browser, urlsToProcess)
          pagesInfoResult.forEach(item => {
            this.pagesProcessed.set(item.pageUrl, item)
            this.emit('pageCrawled', {pageUrl: item.pageUrl, item})
          })
        }
        this.emit('traverseResults', this.pagesProcessed)

        await browser.close()
    
        return this.pagesProcessed
    }

    async processPageBatch(browser, pagesToVisit) {
        const crawlPromises = []
        pagesToVisit.forEach(page => {
          crawlPromises.push(this.crawlPage(browser, page))
          this.emit('crawlPage', this.crawlPage(browser, page))
        })
    
        const results = []
        await Promise.all(crawlPromises).then(allPagesData => {
          this.emit('info', `crawl batch of ${crawlPromises.length} links`)
          allPagesData.forEach(data => {
            const { response, extractedInfo, depth } = data
            if (depth < this.arachnidObject.maxDepth) {
              extractedInfo.links.forEach(link => {
                this.pagesToVisitQ.enqueue({ url: new URL(link), depth: depth + 1 })
              })
            } else {
              //TODO: reached max depth, we should just validate the links are non-broken 200 status code
            }
            delete extractedInfo.links
            const pageInfoResult = {
              pageUrl: extractedInfo.url,
              statusCode: response.status(),
              statusText: response.statusText(),
              contentType: response.headers()['content-type'],
              depth,
              ...extractedInfo,
            }
            results.push(pageInfoResult)
          })
          this.emit('batchResults', results)
        }).catch(err => {
          this.emit('error', err)
        })
    
        return results
    }

    async crawlPage(browser, singlePageLink) {
        const page = await browser.newPage()
        const response = await page.goto(this.getNormalizedLink(singlePageLink.url), { waitUntil: 'domcontentloaded', timeout: 0 })
        const extractedInfo = await mainExtractor(page)
        page.close()
        
        return {
          response,
          extractedInfo,
          depth: singlePageLink.depth
        }
      }

    getNextPageBatch() {
        const urlsToVisit = new Set()
        let i = 0
        while (i < this.arachnidObject.concurrencyNum && !this.pagesToVisitQ.isEmpty()) {
          const currentPage = this.pagesToVisitQ.dequeue()
          const currentPageUrl = currentPage.url
          if (this.shouldProcessPage(currentPageUrl)) {
            urlsToVisit.add(currentPage)
            i++
          }
        }
        return urlsToVisit
    }

    shouldProcessPage(currentPageUrl) {
        return !this.pagesProcessed.has(this.getNormalizedLink(currentPageUrl)) && 
               this.shouldVisit(currentPageUrl)
    }

    shouldVisit(currentPageUrl) {
        //TODO: amend the condition to take into account subdomain links
        //TODO: check that pages are non-broken only if external and add to the results map
       return currentPageUrl.host === this.arachnidObject.domain.host
    }
    
    getNormalizedLink(currentPageUrl) {
        return currentPageUrl.href
    }
}

const obj = new arachnidBuidler().setDomain('https://www.google.com/')
const arachnid2 = new Arachnid2(obj)
arachnid2.traverse()
arachnid2.on('info', res => console.log('from info', res))
arachnid2.on('pageCrawled', res=> console.log('from pageCrawled', res))
arachnid2.on('traverseResults', res=> console.log('from traverseResults', res))
arachnid2.on('batchResults', res => console.log('from batchResults', res))