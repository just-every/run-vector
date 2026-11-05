const Module = require('node:module');
const load = Module._load;
Module._load = function(request, parent, isMain) {
  const value = load.apply(this, arguments);
  if ((String(request).includes('playwright') || String(parent?.filename).includes('playwright')) && value?.chromium?.launch && !value.chromium.__rerCloudBrowser) {
    const browser = value.chromium, launch = browser.launch.bind(browser);
    Object.defineProperty(browser, '__rerCloudBrowser', {value: true});
    browser.launch = (options = {}) => launch({...options, executablePath: '/usr/bin/chromium', args: [...new Set([...(options.args ?? []), '--no-sandbox'])]});
  }
  return value;
};
