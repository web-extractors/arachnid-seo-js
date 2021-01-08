export interface ImageElementAttributes {
  imageAlternateText: string;
  imageSource: string;
}

export interface ImageElementAttributesWithStatusCode extends ImageElementAttributes {
  statusCode: number;
}
