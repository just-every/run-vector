/** Read all native subjects through one projection; writes retain additive tables. */
export const channelBindingSource='(SELECT * FROM vector_channel_bindings UNION ALL SELECT * FROM vector_initiative_channel_bindings)';
