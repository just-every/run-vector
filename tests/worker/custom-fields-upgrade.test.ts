import { env } from 'cloudflare:workers'
import { it } from 'vitest'
import { provePopulatedUpgrade } from './populated-upgrade'

it('[FIELD-001 DATA-005] a populated installation with legacy custom-field values crosses the typed-definition upgrade unchanged and still exports', async () => {
  await provePopulatedUpgrade('0126_custom_field_definitions.sql', {
    until: '0126_custom_field_definitions.sql', removed: [],
    added: ['table custom_field_definitions', 'index custom_field_definitions_team_name', 'table custom_field_options', 'index custom_field_options_name', 'index custom_field_options_position'],
  }, ['issues'], async () => {
    await env.DB.prepare('UPDATE issues SET custom_fields_json=? WHERE id=(SELECT id FROM issues ORDER BY id LIMIT 1)')
      .bind(JSON.stringify({ severity: 'legacy free text', nested: [3, null, { preserve: true }] })).run()
  })
}, 180_000)
