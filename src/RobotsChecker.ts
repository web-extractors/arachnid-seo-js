var robotsParser = require('robots-parser');
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'Puppeteer'... Remove this comment to see the full error message
const Puppeteer = require('puppeteer');

// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'RobotsChec... Remove this comment to see the full error message
class RobotsChecker {
    puppeteerParams: any;
    robotsMap: any;
    constructor(puppeteerParams: any) {
        this.puppeteerParams = puppeteerParams;
        this.robotsMap = new Map();
    }

    async getOrCreateForDomain(domain: any) {
        if (!this.robotsMap.has(domain.host)) {
            const robotsFileUrl = `${domain.origin}/robots.txt`;
            const robotsContents = await this.getRobotsFileText(`${domain.origin}/robots.txt`);
            const robotsParser = this.createRobotsObject(robotsFileUrl, robotsContents);
            this.robotsMap.set(domain.host, robotsParser);
        }

        return this.robotsMap.get(domain.host);
    }

    createRobotsObject(robotsUrl: any, robotsContents: any) {
        return robotsParser(robotsUrl, robotsContents);
    }

    async getRobotsFileText(robotsUrlTxt: any) {
        const browser = await Puppeteer.launch({ headless: true, args: this.puppeteerParams });
        const robotsPage = await browser.newPage();
        const robotsResponse = await robotsPage.goto(robotsUrlTxt, { waitUntil: 'domcontentloaded', timeout: 0 });
        let robotsTxt = "";
        if (robotsResponse.status() >= 200 && robotsResponse.status() <= 299) {
            robotsTxt = await robotsResponse.text();
        }

        robotsPage.close();
        browser.close();

        return robotsTxt;
    }

    async isAllowed(pageUrlTxt: any, userAgent: any) {
        const domainRobots = await this.getOrCreateForDomain(new URL(pageUrlTxt));
        return domainRobots.isAllowed(pageUrlTxt, userAgent);
    }
}


module.exports = RobotsChecker;
