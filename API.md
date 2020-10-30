<a name="Arachnid"></a>

## Arachnid
**Kind**: global class  

* [Arachnid](#Arachnid)
    * [new Arachnid()](#new_Arachnid_new)
    * [.setDomain(domain)](#Arachnid+setDomain)
    * [.setCrawlDepth(depth)](#Arachnid+setCrawlDepth)
    * [.setConcurrency(concurrencyNum)](#Arachnid+setConcurrency)
    * [.setPuppeteerArgs(args)](#Arachnid+setPuppeteerArgs)

<a name="new_Arachnid_new"></a>

### new Arachnid()
entry point to crawling using builder pattern 
Use [setDomain](#Arachnid+setDomain) set main page to crawl.
Use [setCrawlDepth](#Arachnid+setCrawlDepth) set pages to crawl depth.
Use [setConcurrency](#Arachnid+setConcurrency) set concurrency number.
Use [setPuppeteerArgs](#Arachnid+setPuppeteerArgs) set list of arguments used by Puppeteer (this.args).

<a name="Arachnid+setDomain"></a>

### arachnid.setDomain(domain)
**Kind**: instance method of [<code>Arachnid</code>](#Arachnid)  

| Param | Type | Description |
| --- | --- | --- |
| domain | <code>string</code> | set main page to crawl |

<a name="Arachnid+setCrawlDepth"></a>

### arachnid.setCrawlDepth(depth)
**Kind**: instance method of [<code>Arachnid</code>](#Arachnid)  

| Param | Type | Description |
| --- | --- | --- |
| depth | <code>number</code> | set pages to crawl depth |

<a name="Arachnid+setConcurrency"></a>

### arachnid.setConcurrency(concurrencyNum)
**Kind**: instance method of [<code>Arachnid</code>](#Arachnid)  

| Param | Type | Description |
| --- | --- | --- |
| concurrencyNum | <code>number</code> | set concurrency number |

<a name="Arachnid+setPuppeteerArgs"></a>

### arachnid.setPuppeteerArgs(args)
**Kind**: instance method of [<code>Arachnid</code>](#Arachnid)  

| Param | Type | Description |
| --- | --- | --- |
| args | <code>Array</code> | set list of arguments used by Puppeteer (this.args) |

