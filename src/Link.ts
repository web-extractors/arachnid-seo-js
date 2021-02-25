export default class Link {
    private currentPageUrl?: URL;
    private isValidHttpUrl: boolean;

    constructor(private pageUrl: string, private depth: number, private parentLink?: Link) {
        try {
            this.currentPageUrl = new URL(pageUrl);
            this.isValidHttpUrl = true;
        } catch (ex) {
            this.isValidHttpUrl = false;
        }
    }

    public getPageUrl(): URL {
        return this.currentPageUrl!!;
    }

    public getDepth(): number {
        return this.depth;
    }

    public getParentLink(): Link | undefined {
        return this.parentLink;
    }

    public isSameHost(): boolean {
        return (
            this.parentLink === undefined ||
            !this.isValidHttpUrl ||
            this.currentPageUrl!!.host === this.parentLink?.getPageUrl().host
        );
    }

    public isSubDomain(): boolean {
        const strippedMainHost = this.parentLink?.getPageUrl().hostname.replace('www.', '');
        return (
            this.parentLink === undefined ||
            !this.isValidHttpUrl ||
            this.currentPageUrl!!.hostname.endsWith(`.${strippedMainHost}`)
        );
    }

    public isInternalLink(): boolean {
        return this.isSameHost() || this.isSubDomain();
    }

    public getNormalizedLink(): string {
        if (!this.isValidHttpUrl) {
            return this.pageUrl;
        } else {
            const href = this.currentPageUrl!!.href;
            return this.currentPageUrl!!.hash !== null ? href.replace(this.currentPageUrl!!.hash, '') : href;
        }
    }
}
