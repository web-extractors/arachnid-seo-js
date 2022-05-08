import { MetaInfo } from './arachnid'

export interface ImageInfo {
  missingAlt: string[];
}

export interface ExtractedInfo {
  title: string;
  h1: string[];
  h2: string[];
  meta: MetaInfo;
  images?: ImageInfo;
  canonicalUrl?: string;
  links?: string[];
  uniqueOutLinks?: number;
}

export interface ImageElementAttributes {
  imageAlternateText: string;
  imageSource: string;
}

export interface ImageElementAttributesWithStatusCode extends ImageElementAttributes {
  statusCode: number;
}
