import { decodeString } from 'micromark-util-decode-string';
import { markdownIssueReferences } from '../markdown';
import type { MentionNode } from '../../notifications/mention-markdown';
import type { IssueReference } from '../schema';

type Node = MentionNode & {url?:string;title?:string};
/** Replace validated prose spans with ordinary mdast links before mention rendering. */
export function remarkIssueReferences({references=[]}:{references?:readonly IssueReference[]}={}) {
  return (tree:Node,file:{value:unknown}) => {
    const source=String(file.value),visible=new Map(references.map(row=>[row.identifier,row]));
    const spans=markdownIssueReferences(tree,source).filter(span=>visible.has(span.identifier));
    const visit=(node:Node) => {
      if (!node.children) return;
      node.children=node.children.flatMap(child=>{
        const start=child.position?.start.offset,end=child.position?.end.offset;
        if(child.type!=='text'||child.value===undefined||start===undefined||end===undefined){visit(child);return [child];}
        const own=spans.filter(span=>span.start>=start&&span.end<=end);
        if(!own.length)return [child];
        const parts:Node[]=[],original=child.value;let rawCursor=start,decodedCursor=0;
        for(const span of own){
          const token=span.identifier,preceding=decodeString(source.slice(start,span.start)).split(token).length-1;
          let at=-1;for(let n=0;n<=preceding;n++)at=original.indexOf(token,at+1);
          if(at<decodedCursor)continue;
          if(at>decodedCursor)parts.push({type:'text',value:original.slice(decodedCursor,at),position:{start:{offset:rawCursor},end:{offset:span.start}}});
          const reference=visible.get(token)!;
          parts.push({type:'link',url:`/app/issues/${token}`,title:`${reference.title} · ${reference.status.name}`,children:[{type:'text',value:token,position:{start:{offset:span.start},end:{offset:span.end}}}]});
          rawCursor=span.end;decodedCursor=at+token.length;
        }
        if(decodedCursor<original.length)parts.push({type:'text',value:original.slice(decodedCursor),position:{start:{offset:rawCursor},end:{offset:end}}});
        return parts;
      });
    };
    visit(tree);
  };
}
