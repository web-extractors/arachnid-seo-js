// @ts-ignore
import robotsParser from 'robots-parser';
import Puppeteer from 'puppeteer';
<<<<<<< HEAD

export default class RobotsChecker {
  puppeteerParams: any;
  robotsMap: any;
  constructor(puppeteerParams: any) {
=======
import { URL } from 'url';
import { RobotsParser } from './types/robots-parser';

export default class RobotsChecker {
  puppeteerParams: string[];
  robotsMap: Map<string, RobotsParser>;
  constructor(puppeteerParams: string[]) {
>>>>>>> fa8a9103c65c6def2ff0662c6fc9bc9b83d5dcf4
    this.puppeteerParams = puppeteerParams;
    this.robotsMap = new Map();
  }

<<<<<<< HEAD
  async getOrCreateForDomain(domain: any) {
=======
  private async getOrCreateForDomain(domain: URL): Promise<RobotsParser> {
>>>>>>> fa8a9103c65c6def2ff0662c6fc9bc9b83d5dcf4
    if (!this.robotsMap.has(domain.host)) {
      const robotsFileUrl = `${domain.origin}/robots.txt`;
      const robotsContents = await this.getRobotsFileText(`${domain.origin}/robots.txt`);
      const robotsParserObject = this.createRobotsObject(robotsFileUrl, robotsContents);
      this.robotsMap.set(domain.host, robotsParserObject);
    }

<<<<<<< HEAD
    return this.robotsMap.get(domain.host);
  }

  createRobotsObject(robotsUrl: any, robotsContents: any) {
    return robotsParser(robotsUrl, robotsContents);
  }

  async getRobotsFileText(robotsUrlTxt: any) {
=======
    return this.robotsMap.get(domain.host) as RobotsParser;
  }

  private createRobotsObject(robotsUrl: string, robotsContents: string): RobotsParser {
    return robotsParser(robotsUrl, robotsContents);
  }

  private async getRobotsFileText(robotsUrlTxt: string): Promise<string> {
>>>>>>> fa8a9103c65c6def2ff0662c6fc9bc9b83d5dcf4
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

<<<<<<< HEAD
  async isAllowed(pageUrlTxt: any, userAgent: any) {
=======
  public async isAllowed(pageUrlTxt: string, userAgent: string): Promise<boolean> {
>>>>>>> fa8a9103c65c6def2ff0662c6fc9bc9b83d5dcf4
    const domainRobots = await this.getOrCreateForDomain(new URL(pageUrlTxt));
    return domainRobots.isAllowed(pageUrlTxt, userAgent);
  }
}
