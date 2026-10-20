/** Only protocol status and fixed explanations leave the delivery ledger. Never expose receiver bodies. */
export function deliveryResult(state:string,outcome:unknown){
 const value=outcome&&typeof outcome==='object'?outcome as {status?:unknown;code?:unknown}:{};
 const status=typeof value.status==='number'&&Number.isInteger(value.status)&&value.status>=100&&value.status<=599?value.status:null;
 let reason:string;
 if(typeof value.code==='string'&&/^slack_[a-z_]{1,80}$/.test(value.code)&&state!=='accepted')reason='Slack refused this message ('+value.code.slice(6)+'). Check the bot token and channel access.';
 else if(status!==null){
  if(status>=200&&status<300)reason=state==='accepted'?'The receiver accepted this request. Check its workflow for the next action.':'The provider did not accept this request. Check its integration settings.';
  else if(status===400||status===422)reason='The receiver could not use the data. Check its expected fields and workflow setup.';
  else if(status===401||status===403)reason='The receiver refused access. Check that its webhook is enabled and the URL is complete.';
  else if(status===404||status===410)reason='The receiver address was not found or is no longer active. Copy a fresh webhook URL from the receiving app.';
  else if(status===429)reason=state==='queued'?'The receiver is busy. Vector will try again after a short wait.':'The receiver remained busy. The limited retries have ended.';
  else if(status>=300&&status<400)reason='The receiver redirected the request. Use its final webhook address; redirects are not followed.';
  else if(status>=500||status===408)reason='The receiver had a problem or timed out. Check whether it saved the request before recording a result.';
  else reason='The receiver refused this request. Check its webhook settings and request log.';
 }else if(value.code==='preflight_failed')reason='Vector could not prepare the request. Check the destination and signing secret.';
 else if(state==='uncertain')reason='No reliable HTTP reply was received. The receiver may have saved the request; check its log before recording a result.';
 else if(state==='queued')reason='Waiting to send. Refresh delivery history for the result.';
 else if(state==='sending')reason='The request is being sent. Refresh delivery history shortly.';
 else if(state==='accepted')reason='Recorded as accepted using receiver evidence; no HTTP status was captured.';
 else reason='The request was not accepted; no HTTP status was captured. Check the receiver and destination setup.';
 return {httpStatus:status,reason};
}
