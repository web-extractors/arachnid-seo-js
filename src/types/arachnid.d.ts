import { HTTPResponse } from 'puppeteer'
import { URL } from 'url'
import Link from '../Link'
import { ExtractedInfo as ExtractedDomInfo } from './mainExtractor'

export interface UrlWithDepth {
  url: URL;
  depth: number;
}

export interface IndexabilityInfo {
  isIndexable: boolean;
  indexabilityStatus: string;
}

export interface ErrorResponse {
  url(): string;
  status(): number;
  statusText(): string;
  headers(): Record<string, string>;
}

export interface PageResourceType {
  type: string;
  count: number;
  broken: string[];
}

export interface ResultInfo {
  url: string;
  urlEncoded: string;
  statusCode: number;
  statusText: string;
  isInternal: boolean;
  depth: number;
  isIndexable?: boolean;
  indexabilityStatus?: string;
  contentType?: string | null;
  robotsHeader?: string | null;
  redirectUrl?: string;
  DOMInfo?: ExtractedDomInfo;
  resourceInfo?: PageResourceType[];
  parentLink?: Link;
  responseTimeMs?: number;
}

export interface CrawlPageResult {
  link: Link;
  response: HTTPResponse | ErrorResponse;
  extractedInfo?: ExtractedDomInfo;
  resourceInfo?: PageResourceType[];
  depth: number;
  responseTimeMs?: number;
}

export interface MetaInfo {
  title?: string;
  keywords?: string;
  author?: string;
  robots?: string;
  description?: string;
}

export interface UrlsToVisitQ {
  url: URL;
  depth: number;
}

export interface PageInfoResponse {
  statusCode: number;
  statusText: string;
  contentType: string;
  robotsHeader: string;
}

export interface ResultItem {
  url: string;
  statusCode: number;
  statusText: string;
  contentType: string;
  isInternal: boolean;
  depth: number;
  redirectUrl?: string;
  indexability?: boolean;
  indexabilityStatus?: string;
  resourceInfo?: PageResourceType[];
}

export interface ExtractIndexability {
  isIndexable: boolean;
  indexabilityStatus: string;
}
