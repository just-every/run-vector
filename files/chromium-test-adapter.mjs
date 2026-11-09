import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.cwd()+'/node_modules/@playwright/test/index.mjs'));
const launch=chromium.launch.bind(chromium);
chromium.launch=options=>launch({...options,executablePath:'/usr/bin/chromium',args:[...(options?.args??[]),'--no-sandbox']});
