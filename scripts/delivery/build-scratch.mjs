import { lstat, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { candidateRoot, checkedPath } from './base/paths.mjs';

/** Wrangler leaves empty temporary parents after exercising the built Worker.
 * Remove only empty directories: any files, links or other contents still refuse.
 */
export async function removeEmptyWorkerScratch(directory = 'dist/server') {
  const root = await candidateRoot(process.cwd());
  await checkedPath(root, directory, 'directory');
  const scratch = resolve(root, directory, '.wrangler');
  let info;
  try { info = await lstat(scratch); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Worker scratch must be a real empty directory');
  try { await rmdir(join(scratch, 'tmp')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rmdir(scratch);
}
