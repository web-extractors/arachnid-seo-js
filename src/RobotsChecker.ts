// @ts-ignore
import robotsParser from 'robots-parser';
import Puppeteer from 'puppeteer';

export default class RobotsChecker {
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
      const robotsParserObject = this.createRobotsObject(robotsFileUrl, robotsContents);
      this.robotsMap.set(domain.host, robotsParserObject);
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
    let robotsTxt = '';
    if (robotsResponse!.status() >= 200 && robotsResponse!.status() <= 299) {
      robotsTxt = await robotsResponse!.text();
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
