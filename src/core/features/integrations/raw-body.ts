import { IntegrationError } from './errors';
export async function rawIntegrationBody(request:Request,maximum=262144){
 if(!request.body)throw new IntegrationError(400,'body_required');
 const reader=request.body.getReader(),parts:Uint8Array[]=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum)throw new IntegrationError(413,'integration_body_limit');parts.push(value);}}
 finally{await reader.cancel();reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}
