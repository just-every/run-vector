import {useState} from 'react';

export function CopyButton({value,label='Copy'}:{value:string;label?:string}){
 const [status,setStatus]=useState('');
 const copy=async()=>{try{await navigator.clipboard.writeText(value);setStatus('Copied.');}catch{setStatus('Clipboard unavailable. Select the value and copy it manually.');}};
 return <span className="integration-copy"><button type="button" onClick={()=>void copy()}>{label}</button>{status&&<span role="status">{status}</span>}</span>;
}
export function CopyField({label,value}:{label:string;value:string}){
 return <div className="integration-copy-field"><label>{label}<input readOnly value={value} onFocus={event=>event.target.select()}/></label><CopyButton value={value} label={'Copy '+label.toLowerCase()}/></div>;
}
