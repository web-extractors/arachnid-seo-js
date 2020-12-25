var robotsParser = require('robots-parser');
const Puppeteer = require('puppeteer');

class RobotsChecker {
    constructor(puppeteerParams) {
        this.puppeteerParams = puppeteerParams;
        this.robotsMap = new Map();
    }

    async getOrCreateForDomain(domain) {
        if (!this.robotsMap.has(domain.host)) {
            const robotsFileUrl = `${domain.origin}/robots.txt`;
            const robotsContents = await this.getRobotsFileText(`${domain.origin}/robots.txt`);
            const robotsParser = this.createRobotsObject(robotsFileUrl, robotsContents);
            this.robotsMap.set(domain.host, robotsParser);
        }

        return this.robotsMap.get(domain.host);
    }

    createRobotsObject(robotsUrl, robotsContents) {
        return robotsParser(robotsUrl, robotsContents);
    }

    async getRobotsFileText(robotsUrlTxt) {
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

    async isAllowed(pageUrlTxt, userAgent) {
        const domainRobots = await this.getOrCreateForDomain(new URL(pageUrlTxt));
        return domainRobots.isAllowed(pageUrlTxt, userAgent);
    }
}


module.exports = RobotsChecker;
