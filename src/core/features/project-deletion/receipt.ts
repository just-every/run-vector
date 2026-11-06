import {z} from 'zod';
export const receiptSchema=z.object({id:z.string(),projectId:z.string(),version:z.number(),expiresAt:z.number()});
export function receiveProjectUndoReceipt(response:Response) {
 const value=response.headers.get('x-vector-project-undo');
 if(!value||typeof window==='undefined')return;
 const receipt=receiptSchema.safeParse(JSON.parse(value));
 if(receipt.success)window.dispatchEvent(new CustomEvent('vector:project-undo',{detail:receipt.data}));
}
