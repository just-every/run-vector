import { chromium } from '/workspace/run-vector/node_modules/@playwright/test/index.mjs';
const launch = chromium.launch.bind(chromium);
chromium.launch = options => launch({ ...options, executablePath: '/usr/bin/chromium', args: [...(options?.args ?? []), '--no-sandbox'] });
