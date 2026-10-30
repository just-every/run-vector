import {useViewerTime} from '../../../app/viewer-time';
/** When this receiver last durably accepted a signed GitHub event. It observes GitHub's
 * deliveries to Vector, never a call Vector made, so it does not claim provider success. */
export function GithubReceipt({at,revoked}:{at:string|null;revoked:boolean}){
 const {formatInstant}=useViewerTime();
 if(at)return <p>Last GitHub event received <time dateTime={at}>{formatInstant(at)}</time></p>;
 return revoked?null:<p>No GitHub event received yet</p>;
}
