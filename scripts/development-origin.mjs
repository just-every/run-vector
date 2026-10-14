import {join} from 'node:path';
import {readSettings} from '@runeditrun/rer/adapter-settings';
import {privateDirectory,writePrivateFile} from '@runeditrun/rer/private-files';
const receipt={file:'.seed/development.json',format:'json'};
// This is a launch receipt, not another configuration generator. pnpm dev
// records only the origin it read from installation settings before Vite starts.
// The public test command can read it through the kit without touching Vite's
// watched .dev.vars inode (whose private read also refreshes its permissions).
export async function recordDevelopmentOrigin(root,origin) {
 await privateDirectory(root,['.seed']);
 await writePrivateFile(join(root,receipt.file),JSON.stringify({APP_ORIGIN:origin})+'\n');
}
export async function developmentOrigin(root=process.cwd()) {
 const {values}=await readSettings(root,receipt);
 let url;try{url=new URL(values.APP_ORIGIN);}catch{}
 if(!url || url.protocol!=='http:' || url.hostname!=='127.0.0.1' || !url.port || url.origin!==values.APP_ORIGIN)
  throw Error('Run rer setup --owner-email EMAIL, then pnpm dev, before pnpm test:dev.');
 return url.origin;
}
