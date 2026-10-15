import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { selectLocalState } from '@runeditrun/rer/local/state';
import { commandFailure } from '@runeditrun/rer/failures';
export async function guardLocalState({ root }) {
 if (await lstat(join(root, '.wrangler/vector-dev')).catch(error => { if (error.code === 'ENOENT') return null; throw error; })) throw commandFailure('Legacy Vector data exists at .wrangler/vector-dev. Preserve it and follow docs/LOCAL-RECOVERY.md before setup.', { exitCode: 4 });
 await selectLocalState(root);
}
