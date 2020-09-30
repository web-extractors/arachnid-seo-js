const arachnidBuidler = require('./ArachnidBuilder')

const obj = new arachnidBuidler().setDomain('https://www.google.com').setParameters({a:1, b:2})

console.log(obj)

