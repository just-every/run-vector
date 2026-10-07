import { assert, uuid, hexId } from './validation.mjs';
function unique(rows, key, name) { const found = rows.filter(x => x?.[key] === name); assert(found.length <= 1,'ambiguous-resource-name'); return found[0]; }
export async function reconcileResources(api, plan, { create = true } = {}) {
  const resources = { d1:[], r2:[], queues:[] };
  if (plan.d1.length) {
    const rows = await api.list('/d1/database');
    for (const item of plan.d1) {
      let row = unique(rows,'name',item.name);
      if (!row) { assert(create,'missing-d1'); row = await api.request('/d1/database',{ method:'POST',body:{name:item.name} }); }
      assert(row.name === item.name && uuid(row.uuid), 'invalid-d1-identity');
      const read = await api.request(`/d1/database/${row.uuid}`);
      assert(read.uuid === row.uuid && read.name === item.name && (!item.readReplication || read.read_replication?.mode === item.readReplication), 'incompatible-d1');
      resources.d1.push({binding:item.binding,name:item.name,id:row.uuid});
    }
  }
  if (plan.r2.length) {
    const rows = await api.list('/r2/buckets',{field:'buckets',pagination:'cursor'});
    for (const item of plan.r2) {
      let row = unique(rows,'name',item.name);
      if (!row) { assert(create,'missing-r2'); row = await api.request('/r2/buckets',{method:'POST',body:{name:item.name,...(item.locationHint ? {locationHint:item.locationHint}: {})}}); }
      const read = await api.request(`/r2/buckets/${item.name}`);
      assert(row.name === item.name && read.name === item.name && (!item.jurisdiction || read.jurisdiction === item.jurisdiction) && (!item.storageClass || read.storage_class === item.storageClass), 'incompatible-r2');
      resources.r2.push({binding:item.binding,name:item.name});
    }
  }
  if (plan.queues.length) {
    const rows = await api.list('/queues');
    for (const item of plan.queues) {
      let row = unique(rows,'queue_name',item.name);
      if (!row) { assert(create,'missing-queue'); row = await api.request('/queues',{method:'POST',body:{queue_name:item.name}}); }
      assert(row.queue_name === item.name && hexId(row.queue_id), 'invalid-queue-identity');
      const read = await api.request(`/queues/${row.queue_id}`);
      assert(read.queue_name === item.name && read.queue_id === row.queue_id && read.settings?.delivery_paused !== true, 'incompatible-or-paused-queue');
      resources.queues.push({binding:item.binding,name:item.name,id:row.queue_id});
    }
  }
  return resources;
}
export async function reconcileTriggers(api, plan, resources, { mutate = true } = {}) {
  // PUT replaces the entire schedule set. Inspect it before any trigger write,
  // and never remove a schedule that the requested plan does not own.
  const crons = await checkCronOwnership(api, plan);
  for (const item of plan.queues.filter(x => x.consumer)) {
    const id = resources.queues.find(x => x.binding === item.binding).id;
    const consumers = await api.request(`/queues/${id}/consumers`);
    assert(Array.isArray(consumers), 'invalid-queue-consumers');
    const wanted = {type:'worker',script_name:plan.worker,settings:item.consumer};
    const matches = consumers.filter(x => x.type === 'worker' && x.script_name === plan.worker);
    assert(consumers.length === matches.length && matches.length <= 1, 'queue-consumer-conflict');
    const row = matches[0];
    if (!row || Object.entries(item.consumer).some(([k,v]) => row.settings?.[k] !== v)) {
      assert(mutate,'queue-consumer-drift');
      if (row) assert(hexId(row.consumer_id),'invalid-consumer-id');
      await api.request(`/queues/${id}/consumers${row ? `/${row.consumer_id}`:''}`,{method:row ? 'PUT':'POST',body:wanted});
    }
  }
  if (JSON.stringify(crons) !== JSON.stringify([...plan.crons].sort())) {
    assert(mutate,'cron-drift');
    await api.request(`/workers/scripts/${plan.worker}/schedules`,{method:'PUT',body:plan.crons.map(cron => ({cron}))});
  }
}

export async function checkCronOwnership(api, plan) {
  const result = await api.request(`/workers/scripts/${plan.worker}/schedules`);
  assert(result && !Array.isArray(result) && Array.isArray(result.schedules) && result.schedules.every(x => typeof x?.cron === 'string' && x.cron.trim()), 'invalid-cron-list');
  const crons = result.schedules.map(x => x.cron).sort();
  assert(new Set(crons).size === crons.length, 'invalid-cron-list');
  assert(crons.every(cron => plan.crons.includes(cron)), 'cron-drift');
  return crons;
}
