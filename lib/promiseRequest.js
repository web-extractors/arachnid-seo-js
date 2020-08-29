const https = require('https');
const http = require('http');

const requestPromise = (url) => {
    const request = url.startsWith('https') ? https : http;
    return new Promise ((resolve, reject) => {
        request.get(url, (response, error) => {
            if (response.statusCode >= 301) {
                //TODO: handle request redirect
            }
            if (error) {
                reject(error);
            }
            resolve(response);
        })
    }); 
}

module.exports = requestPromise;