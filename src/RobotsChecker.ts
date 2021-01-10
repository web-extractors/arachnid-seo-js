import Puppeteer from 'puppeteer';
import { URL } from 'url';
import { RobotsParser } from './types/robots-parser';
import robotsParser from 'robots-parser';

export default class RobotsChecker {
  private robotsMap: Map<string, RobotsParser>;

  constructor() {
    this.robotsMap = new Map();
  }

  private async getOrCreateForDomain(domain: URL): Promise<RobotsParser> {
    if (!this.robotsMap.has(domain.host)) {
      const robotsFileUrl = `${domain.origin}/robots.txt`;
      const robotsContents = await this.getRobotsFileText(`${domain.origin}/robots.txt`);
      const robotsParserObject = this.createRobotsObject(robotsFileUrl, robotsContents);
      this.robotsMap.set(domain.host, robotsParserObject);
    }

    return this.robotsMap.get(domain.host) as RobotsParser;
  }

  private createRobotsObject(robotsUrl: string, robotsContents: string): RobotsParser {
    return robotsParser(robotsUrl, robotsContents);
  }

  private async getRobotsFileText(robotsUrlTxt: string): Promise<string> {
    const browser = await Puppeteer.launch({ headless: true });
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

  public async isAllowed(pageUrlTxt: string, userAgent: string): Promise<boolean> {
    const domainRobots = await this.getOrCreateForDomain(new URL(pageUrlTxt));
    return domainRobots.isAllowed(pageUrlTxt, userAgent);
  }
}
