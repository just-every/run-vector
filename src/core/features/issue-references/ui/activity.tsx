import { activityTitle } from '../../issues/ui/activity-changes';
export function IssueActivityTitle({kind,nextValue}:{kind:string;nextValue:unknown}) {
 if(kind!=='issue.mentioned')return <>{activityTitle(kind,nextValue)}</>;
 const value=nextValue as {identifier:string;removed:boolean};
 return <><a href={`/app/issues/${value.identifier}`}>Mentioned in {value.identifier}</a>{value.removed?' · reference removed':null}</>;
}
