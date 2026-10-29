import { activityTitle } from '../../issues/ui/activity-changes';
export function IssueActivityTitle({kind,nextValue}:{kind:string;nextValue:unknown}) {
 if(kind!=='issue.mentioned')return <>{activityTitle(kind,nextValue)}</>;
 const value=nextValue as {identifier:string;sourceDocumentId?:string;title?:string;removed:boolean};
 if(value.sourceDocumentId)return <><a href={`/app/documents/${value.sourceDocumentId}`}>Mentioned in {value.title}</a>{value.removed?' · reference removed':null}</>;
 return <><a href={`/app/issues/${value.identifier}`}>Mentioned in {value.identifier}</a>{value.removed?' · reference removed':null}</>;
}
