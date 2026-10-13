// Child commands inherit only runtime plumbing, never ambient provider inputs.
export function commandEnvironment(extra = {}) {
 const names = ['PATH','HOME','USER','TMPDIR','TMP','TEMP','SystemRoot','TZ','CI','PLAYWRIGHT_BROWSERS_PATH','PLAYWRIGHT_SKIP_BROWSER_GC','RER_SERVER_JOURNEY','RER_JOB_POLICY','RER_JOB_MEMBERSHIP','RER_JOBS_DIR','RER_LOCAL_OPERATION','RER_DEV_ORIGIN','RER_RUNTIME_PORT','RER_SERVERS_DIR','RER_SERVER_LIMIT','RER_JOB_QUEUE_DIR','RER_JOB_QUEUE_LEASE','RER_JOB_QUEUE_OWNER','RER_ONBOARDING_PROCESS_OWNER'];
 return { ...Object.fromEntries(names.filter(key => typeof process.env[key] === 'string').map(key => [key,process.env[key]])), WRANGLER_SEND_METRICS:'false', CLOUDFLARE_INCLUDE_PROCESS_ENV:'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false', X_LOCAL_EXPLORER:'false', ...extra };
}
export function isolatedStore(store) {
 return new Proxy(store, { get(target,key) {
  if (key === 'run' || key === 'spawn') return (label,command,args,options={}) => {
   const owner = command === process.execPath && args?.[0] === 'vendor/base/deploy-kit/owner-cli.mjs';
   const allowed = owner ? ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','SESSION_SECRET','SENDGRID_API_KEY'] : ['RER_SERVER_JOURNEY','RER_JOB_POLICY','RER_JOB_MEMBERSHIP','RER_ORIGIN_KEY','RER_LOCAL_OPERATION','CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV','RER_DEV_ORIGIN','RER_RUNTIME_PORT','RER_RUNTIME_HOST','RER_DEV_KEY','RER_DEV_IDENTITY'];
   const extra = Object.fromEntries(allowed.filter(name => options.env?.[name] !== undefined).map(name => [name, options.env[name]]));
   const env = commandEnvironment(extra);
   // A caller that passes its own environment without the operation token (Base's browser installer
   // runs each public command under its own operation) must not get the ambient one back.
   if (options.env && options.env.RER_LOCAL_OPERATION === undefined) delete env.RER_LOCAL_OPERATION;
   return target[key].call(target,label,command,args,{...options,env});
  };
  const value = Reflect.get(target,key,target); return typeof value === 'function' ? value.bind(target) : value;
 } });
}
