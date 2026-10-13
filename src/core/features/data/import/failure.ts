import { ImportError } from './types';
/** Refuse safely without sending raw driver diagnostics or private SQL values. */
export async function importOperation<T>(work:()=>Promise<T>):Promise<T> {
 try{return await work();}catch(error){
  if(error instanceof ImportError)throw error;
  const code=error instanceof Error?error.message:'';
  if(/^(?:OPERATION_KEY_CONFLICT|SOURCE_ID_CONTENT_CONFLICT|NATIVE_EDIT_CONFLICT|TARGET_REVISION_CONFLICT|REVIEW_FINGERPRINT_MISMATCH|JOB_BINDING_MISMATCH|IMPORT_ALREADY_REVERSING)$/.test(code))
   throw new ImportError(409,'import_conflict','The retained source, review or native records changed. Read the run; no existing issue was overwritten.');
  throw new ImportError(503,'import_unavailable','The import could not be durably completed. Read or resume the retained run; native publication is all or none.');
 }
}
