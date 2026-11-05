/** The scheduler stores symbolic failures; Settings explains each one without private detail. */
const failures:Record<string,string>={
  stale_template:'The template changed after this series was configured. Nothing was created.',
  not_found:'The template or team is no longer available. Nothing was created.',
  forbidden:'The person who configured this series can no longer create it in this team. Nothing was created.',
  invalid_option:'A label, status, project or assignee it uses is no longer available. Nothing was created.',
  invalid_request:'Its saved values are no longer valid for this team. Nothing was created.',
  calendar_unavailable:'The next local date does not exist in the series timezone. Nothing was created.',
}
export const failureText=(code:string)=>failures[code]??'Creation failed. Nothing was created; a later run retries this week.'
