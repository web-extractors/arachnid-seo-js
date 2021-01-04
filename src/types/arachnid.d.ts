import { Headers, Response } from 'puppeteer';
import { URL } from 'url';
import { ExtractedInfo } from './mainExtractor';

export interface UrlWithDepth {
  url: URL;
  depth: number;
}

export interface IndexabilityInfo {
  isIndexable: boolean;
  indexabilityStatus: string;
}

export interface ResultInfo extends ExtractedInfo {
  url: string;
  statusCode: number;
  statusText: string;
  isInternal: boolean;
  depth: number;
  isIndexable?: boolean;
  indexabilityStatus?: string;
  contentType?: string | null;
  robotsHeader?: string | null;
  linksCount?: number;
  redirectUrl?: string;
}

export interface CrawlPageResult {
  url: string;
  response: Response | ErrorResponse;
  extractedInfo?: ExtractedInfo;
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

export interface UrlsToVisitQ {
  url: URL,
  depth: number
}

export interface PageInfoResponse {
  statusCode: number,
  statusText: string,
  contentType: string,
  robotsHeader: string,
}

export interface ResultItem {
  url: string;
  statusCode: number;
  statusText: string;
  contentType: string;
  isInternal: any;
  depth: number;
  redirectUrl?: string;
  indexability?: boolean;
  indexabilityStatus?: string;  
}

export interface ExtractIndexability {
  isIndexable: boolean
  indexabilityStatus: string
}
