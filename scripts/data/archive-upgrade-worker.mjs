import {archiveUpgradePlan} from './archive-upgrade-plan.mjs';
import {PortabilityError} from '@runeditrun/rer/modules/portability';

// IPC carries schema names and digests only. Never echo parser/database errors:
// their messages can contain private archive cells.
let reply;
try {reply={ok:true,plan:await archiveUpgradePlan(JSON.parse(process.argv[2]))};}
catch(error) {
 reply={ok:false,reason:error instanceof PortabilityError?error.code.split(':')[0]:error.message==='archive_json'?'archive_json':'archive_upgrade_plan_failed'};
 process.exitCode=1;
}
await new Promise(resolve=>process.send(reply,resolve));process.disconnect();
