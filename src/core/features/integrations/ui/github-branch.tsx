import {useState} from 'react';
import {githubBranchName} from '../github/branch-name';
export function GithubBranch({identifier,title}:{identifier:string;title:string}){
 const value=githubBranchName(identifier,title),[message,setMessage]=useState('');
 const copy=async()=>{try{await navigator.clipboard.writeText(value);setMessage('Branch name copied.');}catch{setMessage('Select the branch name to copy it.');}};
 return <section className="detail-section" aria-label="Git branch"><label>Branch name<input readOnly value={value} onFocus={event=>event.target.select()} style={{width:'100%',minWidth:0}}/></label><button type="button" title="Copy branch name" onClick={()=>void copy()}>Copy branch name</button>{message&&<span role="status">{message}</span>}</section>;
}
