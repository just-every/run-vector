import { createPortability } from '../../../../scripts/base-cli/modules/portability/index.mjs';
import { portabilityPolicy } from './archive-policy.mjs';
import { validateArchiveInventory,validateArchiveAttachments } from './archive-inventory.mjs';
/** One engine and one product schema/attachment policy for native bindings. */
export async function createVectorArchive({db,files}) {
 await validateArchiveInventory(db);await validateArchiveAttachments(db,files);
 return createPortability({db,buckets:{FILES:files},policy:portabilityPolicy});
}
