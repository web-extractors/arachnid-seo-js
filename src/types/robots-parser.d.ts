export interface RobotsParser {
  isAllowed: (pageUrl: string, userAgent: string) => boolean | undefined;
  isDisallowed: (pageUrl: string, userAgent: string) => boolean | undefined;
  getCrawlDelay: (userAgent: string) => number;
  getSitemaps: () => string[];
  getPreferedHost(): string;
}
