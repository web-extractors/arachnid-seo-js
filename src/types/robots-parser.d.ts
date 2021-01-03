export interface RobotsParser {
  isAllowed: (pageUrl: string, userAgent: string) => boolean;
  isDisallowed: (pageUrl: string, userAgent: string) => boolean;
  getCrawlDelay: (userAgent: string) => number;
  getSitemaps: () => string[];
  getPreferedHost(): string;
}
