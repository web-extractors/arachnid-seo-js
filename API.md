## Functions

<dl>
<dt><a href="#setCrawlDepth">setCrawlDepth(depth)</a></dt>
<dd><p>set depth of links to crawl (based on BFS algorithm)</p>
</dd>
<dt><a href="#setMaxResultsNum">setMaxResultsNum(maxResultsNum)</a></dt>
<dd><p>set maximum links count to be traversed/returned</p>
</dd>
<dt><a href="#setConcurrency">setConcurrency(concurrencyNum)</a></dt>
<dd><p>set number of urls to crawl concurrenctly at same time</p>
</dd>
<dt><a href="#setPuppeteerOptions">setPuppeteerOptions(options)</a></dt>
<dd><p>set Puppeteer Launch Options</p>
</dd>
<dt><a href="#ignoreRobots">ignoreRobots()</a></dt>
<dd><p>ignore allow/disallow rules written in robots.txt (robots.txt support enabled by default)</p>
</dd>
<dt><a href="#shouldFollowSubdomains">shouldFollowSubdomains(shouldFollow)</a></dt>
<dd><p>enable or disable following links for subdomains of main domain</p>
</dd>
</dl>

<a name="setCrawlDepth"></a>

## setCrawlDepth(depth)
set depth of links to crawl (based on BFS algorithm)

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| depth | <code>number</code> | depth value |

<a name="setMaxResultsNum"></a>

## setMaxResultsNum(maxResultsNum)
set maximum links count to be traversed/returned

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| maxResultsNum | <code>number</code> | maximum results number |

<a name="setConcurrency"></a>

## setConcurrency(concurrencyNum)
set number of urls to crawl concurrenctly at same time

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| concurrencyNum | <code>number</code> | concurrency number |

<a name="setPuppeteerOptions"></a>

## setPuppeteerOptions(options)
set Puppeteer Launch Options

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | puppeteer launch options |

<a name="ignoreRobots"></a>

## ignoreRobots()
ignore allow/disallow rules written in robots.txt (robots.txt support enabled by default)

**Kind**: global function  
<a name="shouldFollowSubdomains"></a>

## shouldFollowSubdomains(shouldFollow)
enable or disable following links for subdomains of main domain

**Kind**: global function  

| Param | Type |
| --- | --- |
| shouldFollow | <code>boolean</code> | 

