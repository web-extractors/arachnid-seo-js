import { EventEmitter } from 'events';
import { Browser, Response } from 'puppeteer';
import { CrawlPageResult, ErrorResponse, ResultInfo, PageResourceType } from './types/arachnid';
import { extractor as mainExtractor } from './mainExtractor';
import Link from './Link';
import RobotsChecker from './RobotsChecker';

export default class PageCrawler extends EventEmitter {
    constructor(
        private followSubDomains: boolean,
        private robotsIsIgnored: boolean,
        private robotsChecker: RobotsChecker | undefined,
    ) {
        super();
    }

    public async crawlPage(singlePageLink: Link, browser: Browser): Promise<CrawlPageResult> {
        try {
            return await this.doCrawlPage(singlePageLink, browser);
        } catch (e: any) {
            return {
                link: singlePageLink,
                depth: singlePageLink.getDepth(),
                response: this.getErrorResponse(singlePageLink.getNormalizedLink(), "Couldn't crawl link, unable to resolve host or connectivity issue")
            }
        }
    }

    public async doCrawlPage(singlePageLink: Link, browser: Browser): Promise<CrawlPageResult> {
        const singlePageUrl = singlePageLink.getPageUrl().toString();
        const userAgent = await browser.userAgent();
        const isAllowedByRobotsTxt = await this.isAllowedByRobotsTxt(singlePageUrl, userAgent);
        if (!isAllowedByRobotsTxt) {
            this.emit('info', `${singlePageUrl} is blocked by robots.txt`);
            return this.getRobotsBlockedResult(singlePageLink);
        }
        const page = await browser.newPage();
        const redirectChain = [singlePageUrl];
        const resourcesMap = new Map<string, PageResourceType>();
        page.on('response', async (subResponse: Response) => {
            if ([301, 302].includes(subResponse.status()) && redirectChain.includes(subResponse.url())) {
                redirectChain.push(subResponse.headers().location);
                const subrequestRobotsAllowed = await this.isAllowedByRobotsTxt(subResponse.url(), userAgent);
                if (!subrequestRobotsAllowed) {
                    this.markResponseAsVisited(
                        this.getErrorResponse(subResponse.url(), 'Blocked by robots.txt'),
                        singlePageLink,
                    );
                } else {
                    this.markResponseAsVisited(subResponse, singlePageLink);
                }
            } else if (singlePageLink.isInternalLink()) {
                this.recordSubResource(subResponse, resourcesMap);
            }
        });
        this.emit('pageCrawlingStarted', { url: decodeURI(singlePageUrl), depth: singlePageLink.getDepth() });
        const response: Response | ErrorResponse | null = await page
            .goto(singlePageLink.getNormalizedLink(), { waitUntil: 'domcontentloaded', timeout: 0 })
            .catch((error: Error) => {
                if (error?.stack?.includes('ERR_NAME_NOT_RESOLVED')) {
                    return this.getErrorResponse(singlePageUrl, 'Invalid Domain name, cannot be resolved');
                } else if (error?.stack?.includes('ERR_CONNECTION_REFUSED')) {
                    return this.getErrorResponse(singlePageUrl, 'Connection refused');
                } else if (error?.stack?.includes('net::ERR_INTERNET_DISCONNECTED')) {
                    return this.getErrorResponse(singlePageUrl, 'Cannot connect to website');
                } else {
                    return this.getErrorResponse(singlePageUrl, 'Unknown error');
                }
                
            });
        let extractedInfo;
        if (!response || response.status() > 399 || response.status() === 0) {
            this.emit('pageCrawlingFailed', {
                url: decodeURI(singlePageUrl),
                statusCode: response?.status()
            });
        } else {
            this.emit('pageCrawlingSuccessed', { url: decodeURI(singlePageUrl), statusCode: response.status() });
            if (this.shouldExtractInfo(singlePageLink, response)) {
                try {
                    extractedInfo = await mainExtractor(page);
                } catch (ex) {
                    this.emit('error', `cannot extract info for ${singlePageUrl}, reason: ${JSON.stringify(ex)}`);
                }
            }
        }

        const pagePerformanceEntry = JSON.parse(
            await page.evaluate(() => JSON.stringify(performance.getEntries()))
          ).filter((obj: any) => redirectChain.includes(obj.name));

        await page.close().catch((e: Error) => {
            if (e.message.includes('Connection closed')) {
                return 0; // Either invalid request or a race condition
            }
        });
        const resultItem: CrawlPageResult = {
            link: singlePageLink,
            response: response ? response : this.getErrorResponse(singlePageUrl, 'Unknown error'),
            extractedInfo,
            depth: singlePageLink.getDepth(),
            responseTimeMs: pagePerformanceEntry.length > 0 ? Math.floor(pagePerformanceEntry[0].responseStart - pagePerformanceEntry[0].requestStart): undefined
        };

        if (singlePageLink.isInternalLink()) {
            resultItem.resourceInfo = Array.from(resourcesMap.values());
        }

        return resultItem;
    }

    private async isAllowedByRobotsTxt(pageLink: string, userAgent: string): Promise<boolean> {
        if (this.robotsIsIgnored || !this.robotsChecker) {
            return true;
        }

        return await this.robotsChecker
            .isAllowed(pageLink, userAgent)
            .catch((ex: Error) =>
                this.emit(
                    'error',
                    `cannot evaluate robots.txt related to url: ${pageLink}, exception: ${ex.toString()}`,
                ),
            );
    }

    private recordSubResource(subResponse: Response, resourcesMap: Map<string, PageResourceType>) {
        const isBroken = subResponse.status() >= 400;
        const resourceType = subResponse.request().resourceType();
        if (!resourcesMap.has(resourceType)) {
            resourcesMap.set(resourceType, { type: resourceType, count: 0, broken: [] });
        }
        const resourceItem = resourcesMap.get(resourceType)!;
        resourceItem.count++;
        if (isBroken) {
            resourceItem.broken.push(subResponse.url());
        }
        resourcesMap.set(resourceType, resourceItem);
    }

    private getRobotsBlockedResult(singlePageLink: Link): CrawlPageResult {
        const response = this.getErrorResponse(singlePageLink.getPageUrl().toString(), 'Blocked by robots.txt');
        return {
            link: singlePageLink,
            response,
            depth: singlePageLink.getDepth(),
        };
    }

    private getErrorResponse(singlePageUrl: string, reason: string): ErrorResponse {
        return {
            url: () => singlePageUrl,
            status: () => 0,
            statusText: () => reason,
            headers: () => {
                return {};
            },
        };
    }

    private shouldExtractInfo(pageLink: Link, response: Response | ErrorResponse): boolean {
        if (response.headers()['content-type'] && !response.headers()['content-type'].includes('text/html')) {
            this.emit('pageCrawlingSkipped', {
                url: decodeURI(pageLink.getPageUrl().toString()),
                reason: `Content is non html (${response.headers()['content-type']})`,
            });
            return false;
        } else if (this.followSubDomains && pageLink.isSubDomain()) {
            return true;
        } else if (pageLink.isSameHost()) {
            return true;
        } else {
            this.emit('pageCrawlingSkipped', {
                url: decodeURI(pageLink.getPageUrl().toString()),
                reason: 'External Url',
            });
            return false;
        }
    }

    private markResponseAsVisited(response: Response | ErrorResponse, originalLink: Link) {
        const responseUrl = new URL(response.url());
        const pageLink = new Link(responseUrl.toString(), originalLink.getDepth(), originalLink);
        const pageUrl = pageLink.getNormalizedLink();

        const resultItem: ResultInfo = {
            url: decodeURI(pageUrl),
            urlEncoded: pageUrl,
            statusCode: response.status(),
            statusText: response.statusText(),
            contentType: response.headers()['content-type'],
            isInternal: pageLink.isInternalLink(),
            robotsHeader: null,
            depth: originalLink.getDepth(),
        };
        if ([301, 302].includes(response.status())) {
            resultItem.redirectUrl = decodeURI(response.headers().location);
            resultItem.isIndexable = false;
            resultItem.indexabilityStatus = 'Redirected';
        }

        this.emit('pageItemVisited', resultItem);
    }
}
