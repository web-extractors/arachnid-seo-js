interface Item {
  url: URL;
  statusCode: number;
  statusText: string;
  redirectUrl: string;
  contentType: string;
  isInternal: boolean;
}

interface Page {
  url: URL;
  depth: number;
}
