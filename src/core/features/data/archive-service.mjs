import { createPortability } from '@runeditrun/rer/modules/portability';
import { portabilityPolicy,archiveImportPolicy } from './archive-policy.mjs';
import { validateArchiveInventory,validateArchiveAttachments } from './archive-inventory.mjs';
/** One engine and one product schema/attachment policy for native bindings. */
export async function createVectorArchive({db,files}) {
 await validateArchiveInventory(db);await validateArchiveAttachments(db,files);
 const options={db,buckets:{FILES:files},policy:portabilityPolicy};
 const service=await createPortability(options),create=service.imports.create;
 service.imports.create=async(manifest,actor)=>{
  const policy=archiveImportPolicy(manifest);
  return policy===portabilityPolicy?create(manifest,actor):(await createPortability({...options,policy})).imports.create(manifest,actor);
 };
 return service;
}
