const {channel} = require('node:diagnostics_channel');
const {appendFileSync} = require('node:fs');
const target = process.env.RER_SDK_TRANSPORT_RECORD;
const code = value => /^(UND_|ECONN|EPIPE|ETIMEDOUT|ERR_)[A-Z0-9_]+$/.test(value ?? '') ? value : null;
channel('undici:request:error').subscribe(({request,error}) => {
  if (!target || request?.method !== 'PATCH' || !String(request?.path).startsWith('/api/v1/')) return;
  const name = ['Error','TypeError','SocketError','RequestAbortedError','ResponseContentLengthMismatchError'].includes(error?.constructor?.name) ? error.constructor.name : 'OtherError';
  appendFileSync(target, JSON.stringify({event:'undici:request:error',class:name,code:code(error?.code),causeCode:code(error?.cause?.code),at:new Date().toISOString()}) + '\n');
});
