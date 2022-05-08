import Puppeteer, { LaunchOptions } from 'puppeteer'
import { URL } from 'url'
import robotsParser from 'robots-parser'
import { RobotsParser } from './types/robots-parser'

export default class RobotsChecker {
  private puppeteerParams: LaunchOptions;

  private robotsMap: Map<string, RobotsParser>;

  constructor (puppeteerParams: LaunchOptions) {
    this.puppeteerParams = puppeteerParams
    this.robotsMap = new Map()
  }

  private async getOrCreateForDomain (domain: URL): Promise<RobotsParser> {
    if (!this.robotsMap.has(domain.host)) {
      const robotsFileUrl = `${domain.origin}/robots.txt`
      const robotsContents = await this.getRobotsFileText(`${domain.origin}/robots.txt`).catch((ex: Error) => '')
      const robotsParserObject = this.createRobotsObject(robotsFileUrl, robotsContents)
      this.robotsMap.set(domain.host, robotsParserObject)
    }

    return this.robotsMap.get(domain.host) as RobotsParser
  }

  private createRobotsObject (robotsUrl: string, robotsContents: string): RobotsParser {
    return robotsParser(robotsUrl, robotsContents)
  }

  private async getRobotsFileText (robotsUrlTxt: string): Promise<string> {
    const browser = await Puppeteer.launch({ headless: true, ...this.puppeteerParams })
    const robotsPage = await browser.newPage()
    const robotsResponse = await robotsPage.goto(robotsUrlTxt, { waitUntil: 'domcontentloaded', timeout: 0 })
    let robotsTxt = ''
    if (robotsResponse!.status() >= 200 && robotsResponse!.status() <= 299) {
      robotsTxt = await robotsResponse!.text()
    }

    browser.close()
    return robotsTxt
  }

  public async isAllowed (pageUrlTxt: string, userAgent: string): Promise<boolean> {
    const domainRobots = await this.getOrCreateForDomain(new URL(pageUrlTxt))
    const ret = domainRobots.isAllowed(pageUrlTxt, userAgent)
    return ret ?? true // default allowed
  }
}
