import { Buffer } from 'node:buffer';
import { readFileSource } from '../../../../../vendor/base/import-kit/src/readers/index';
import { canonicalJson, sha256 } from '../../../../../vendor/base/import-kit/src/d1/index';
import type { Json, SourceRecord, SourceBundle } from '../../../../../vendor/base/import-kit/src/d1/index';
import { prepareProfile,isProfile } from './profiles';
import { readJiraCsv } from './jira';
import { parseCsv } from './csv';
import { readApiFile,apiPayloadKey } from './api-file';
import { ImportError, importLimits, type ImportInput, type ParsedImport } from './types';

export async function parseImport(input: ImportInput): Promise<ParsedImport> {
  if (!['csv','json','linear-csv','linear-api-json','jira-csv','plane-csv','huly-json','shortcut-csv'].includes(input.format)) throw new ImportError(400,'invalid_format');
  if ((input.format==='linear-api-json')!==Boolean(input.api)) throw new ImportError(400,'invalid_format','The Linear API file goes with the linear-api-json format, and that format needs it.');
  if (typeof input.name !== 'string' || !/^[^/\\\x00-\x1f]{1,160}$/.test(input.name)) throw new ImportError(400,'invalid_file_name');
  if (typeof input.source !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(input.source)) throw new ImportError(400,'invalid_source');
  if (typeof input.base64 !== 'string' || input.base64.length > Math.ceil(importLimits.bytes / 3) * 4) throw new ImportError(413,'import_byte_limit');
  const bytes = Buffer.from(input.base64,'base64');
  if (bytes.toString('base64') !== input.base64) throw new ImportError(400,'invalid_base64');
  if (bytes.byteLength > importLimits.bytes) throw new ImportError(413,'import_byte_limit');
  const errors: ParsedImport['errors'] = [], headers = new Set<string>();
  const sourceId = (payload: Record<string,Json>, index: number) => {
    const field = input.mapping.sourceId, id = field ? payload[field] : undefined;
    if (typeof id !== 'string' || !id.trim() || id.length > 128) {
      errors.push({ row:index, field:'sourceId',code:'invalid_source_id',message:'Choose a column with an original issue ID for every row (1 to 128 characters). Keep these IDs unchanged when importing this source again.'});
      return 'row:'+index;
    }
    return id;
  };
  const prepare=(raw:Record<string,Json>,row:number)=>{
    const result=prepareProfile(input,raw,row);errors.push(...result.errors);
    if(isProfile(input.format))for(const column of Object.values(input.mapping))result.payload[column]??='';
    return result.payload;
  };
  if (input.format === 'json' || input.format === 'huly-json') {
    // Base's strict JSON reader rejects duplicate keys, unsafe integers and
    // malformed UTF-8 before application mappings can lose information.
    let root: unknown;
    try { root = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'')); }
    catch { throw new ImportError(400,'invalid_json'); }
    if (!Array.isArray(root)) throw new ImportError(400,'json_array_required');
    if (root.length > importLimits.rows) throw new ImportError(413,'import_row_limit');
    let source: SourceBundle;
    try { source = await readFileSource({namespace:input.source,name:input.name,bytes,format:'json',parse:(value,index)=>{
      const row=index+1;
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push({row,code:'object_required',message:'Each JSON row must be an object.'});
        return {kind:'issue',sourceId:'row:'+row,payload:value};
      }
      Object.keys(value).forEach(key=>headers.add(key));
      const payload=prepare(value,row);
      return {kind:'issue',sourceId:sourceId(payload,row),payload};
    }},{maxBytes:importLimits.bytes,maxRecords:importLimits.rows,maxRecordBytes:importLimits.bytes});
    } catch { throw new ImportError(400,'invalid_json','JSON must preserve distinct keys, safe numbers and valid source records.'); }
    return { source, headers:[...headers], errors };
  }
  let text: string;
  try { text = new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
  catch { throw new ImportError(400,'invalid_utf8'); }
  const csv = parseCsv(text,{repeatedHeaders:input.format==='jira-csv'});
  const jira=input.format==='jira-csv'?readJiraCsv(csv,input):null;
  if(jira)errors.push(...jira.errors);
  if (csv.rows.length > importLimits.rows) throw new ImportError(413,'import_row_limit');
  const hash=sha256(bytes),records:SourceRecord[]=[];
  const api=input.api?readApiFile(input.api.base64):null,joined=new Set<string>();
  if(api)errors.push(...api.errors);
  for (const row of csv.rows) {
    if (row.values.length !== csv.headers.length) errors.push({row:row.row,code:'column_count',message:`Expected ${csv.headers.length} fields; received ${row.values.length}.`});
    const payload=prepare(jira?.payloads.get(row.row)??Object.fromEntries(csv.headers.map((header,index)=>[header,row.values[index]??''])) as Record<string,Json>,row.row);
    // The API file's issue joins its CSV row by Linear ID before hashing.
    const id=input.mapping.sourceId?payload[input.mapping.sourceId]:undefined,node=typeof id==='string'?api?.issues.get(id):undefined;
    if(node){payload[apiPayloadKey]=node as unknown as Json;joined.add(id as string);}
    records.push({namespace:input.source,kind:'issue',sourceId:sourceId(payload,row.row),payload,payloadHash:sha256(canonicalJson(payload)),artifactHash:hash,location:{artifact:input.name,row:row.row}});
  }
  const artifacts=[{name:input.name,sha256:hash,size:bytes.byteLength,original:{status:'available' as const,base64:input.base64}}];
  if(api && input.api) {
    // Nothing from the API file may land outside this CSV run.
    [...api.issues.entries()].forEach(([identifier,issue],index)=>{if(!joined.has(identifier))errors.push({row:index+1,field:'api identifier',code:issue.comments.length?'api_comment_outside_run':'api_unknown_source',message:`API issue ${identifier} is not a row of this CSV run${issue.comments.length?', so its comments cannot be imported':''}.`});});
    const apiBytes=Buffer.from(input.api.base64,'base64');
    artifacts.push({name:input.api.name,sha256:sha256(apiBytes),size:apiBytes.byteLength,original:{status:'available',base64:input.api.base64}});
  }
  return {headers:csv.headers,errors,...(jira?{jiraDates:jira.review}:{}),source:{records,artifacts,diagnostics:[]}};
}
