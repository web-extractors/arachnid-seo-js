const events = require('events')


class ArachnidBuilder extends events {
    constructor() {
        super();
        this.domain = ''
        this.params = {}
        this.maxDepth = 1
        this.concurrencyNum = 1;
    }

    setDomain(domain) {
        if (!this._isValidHttpUrl(domain)) {
            throw Error('Please enter website url has secure protocol "https"')
        }
        this.domain = new URL(domain)
        return this
    }

    setCrawlDepth(depth) {
        this.maxDepth = depth
        return this
    }

    setConcurrency(concurrencyNum) {
        this.concurrencyNum = concurrencyNum
        return this
    }

    setParameters(parameters) {
        this.params = parameters
        return this
    }

    build() {
        return new ArachnidBuilder(this)
    }

    _isValidHttpUrl(string) {
        let url;
      
        try {
          url = new URL(string);
        } catch (_) {
          return false;  
        }
      
        return url.protocol === 'https:' || url.protocol === 'http:'
    }

    safeErrorEmitter(err) {
        if (this.listenerCount('error').length > 0) {
            this.emit('error', err)
        }
    }
}

module.exports = ArachnidBuilder