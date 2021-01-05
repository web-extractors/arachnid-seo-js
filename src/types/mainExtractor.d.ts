import { MetaInfo } from './arachnid';

export interface ExtractedInfo {
    title?: string;
    h1?: string[];
    h2?: string[];
    meta?: MetaInfo;
    images?: ImageInfo;
    canonicalUrl?: string;
    links?: string[];
}

export interface ImageInfo {
    missingAlt: string[];
    broken: string[];
}
