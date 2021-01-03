import { Headers, Response } from 'puppeteer';
import { URL } from 'url';
import { ExtractedInfo, ImageInfo } from './mainExtractor';

export interface UrlWithDepth {
  url: URL;
  depth: number;
}

export interface IndexabilityInfo {
  isIndexable: boolean;
  indexabilityStatus: string;
}

export interface ResultInfo {
  url: string;
  statusCode: number;
  statusText: string;
  isInternal: boolean;
  depth: number;
  isIndexable?: boolean;
  indexabilityStatus?: string;
  contentType?: string | null;
  robotsHeader?: string | null;
  title?: string;
  h1?: string[];
  h2?: string[];
  linksCount?: number;
  meta?: MetaInfo;
  images?: ImageInfo;
  canonicalUrl?: string;
  redirectUrl?: string;
}

export interface CrawlPageResult {
  url: string;
  response: Response | ErrorResponse | null;
  extractedInfo: ExtractedInfo | null | undefined;
  depth: number;
}

export interface MetaInfo {
  title?: string;
  keywords?: string;
  author?: string;
  robots?: string;
  description?: string;
}

export interface ErrorResponse {
  url(): string;
  status(): number,
  statusText(): string,
  headers(): Headers
}
