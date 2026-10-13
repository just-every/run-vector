// Historical paid-edge outcomes are synthetic test data in the actual native store.
// No test emits an email or asks a real provider to manufacture these outcomes.
export function populateDeliveryHistory(installation,{issue,owner,peer}){
 const quote=value=>"'"+String(value).replaceAll("'","''")+"'",at='2026-10-01T00:00:00.000Z';
 const statements=[];
 for(const [index,state] of ['pending','accepted','uncertain'].entries()){
  const id='archive-delivery-'+index;
  statements.push(`INSERT INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at,read_at) VALUES(${quote(id)},${quote(id)},${quote(issue.id)},${quote(peer)},${quote(owner)},'Sarah','["mention"]',${quote(at)},${index?quote(at):'NULL'})`);
  statements.push(`INSERT INTO notification_deliveries(id,notification_id,recipient_id,actor_id,actor_name,identifier,title,app_link,status,attempts,created_at,updated_at) VALUES(${quote(id)},${quote(id)},${quote(peer)},${quote(owner)},'Sarah',${quote(issue.identifier)},'Historical notification',${quote(installation.origin+'/app/issues/'+issue.identifier)},${quote(state)},${index?1:0},${quote(at)},${quote(at)})`);
  if(index)statements.push(`INSERT INTO notification_delivery_attempts(id,delivery_id,number,status,started_at,settled_at) VALUES(${quote(id)},${quote(id)},1,${quote(state)},${quote(at)},${quote(at)})`);
 }
 statements.push(`UPDATE issues SET custom_fields_json='{"retainedNativeField":"exact original value"}' WHERE id=${quote(issue.id)}`);
 installation.fixture(statements.join(';')+';');
}
