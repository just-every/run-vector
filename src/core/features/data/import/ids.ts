import { canonicalJson,sha256 } from '../../../../../vendor/base/import-kit/src/d1/index';

/** A stable ULID-shaped ID for one imported record, from its run and source identity. */
export function stableImportId(destination:string,source:string,id:string,kind:string): string {
  let bits=BigInt('0x'+sha256(canonicalJson([destination,source,id,kind])).slice(0,32));
  const alphabet='0123456789ABCDEFGHJKMNPQRSTVWXYZ';let result='';
  for(let i=0;i<26;i++){result=alphabet[Number(bits&31n)]+result;bits>>=5n;}
  return result;
}
