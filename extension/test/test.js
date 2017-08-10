const JSDOM = require('jsdom').JSDOM;
const fs = require('fs');
const HTML = fs.readFileSync(__dirname + "/test.html");
const dom = new JSDOM(HTML);
const assert = require('assert');
const { parser, TIMELINE_SELECTOR, SIDEBAR_SELECTOR } = require('../src/parser.js');

// Not ideal, but we slot in document for the parser's use.
// It is the easiest way.
global.document = dom.window.document;

// Mock mutation observer for this test
class MutationObserver {
  constructor(cb) {
    this.cb = cb;
  }

  observe() {
    this.cb(document.body, this);
  }

  disconnect() {

  }
}

global.MutationObserver = MutationObserver;
global.URL = require('url').URL;

const doit = () => {
  let posts = Array.from(document.querySelectorAll(TIMELINE_SELECTOR))
    .concat(Array.from(document.querySelectorAll(SIDEBAR_SELECTOR)));
  let results = [];
  return posts.reduce((p, i) => p.then(() => {
    return parser(i).then((it) => results.push(it));
  }), Promise.resolve(null)).then(() => results.filter((i) => i));
};

console.time();
doit().then((ads) => {
  assert.equal(ads.length, 9, "Found nine ads");
  assert.equal(ads[0].id, "6072446206112", "Got an ad");
  assert.equal(ads[7].id, "23842581173480600", "Found the other.");
  console.timeEnd();
});

process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.log('unhandledRejection', error);
  throw error;
});
