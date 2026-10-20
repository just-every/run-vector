# Recorded held-channel safety read

UTC: 2026-10-20T19:24:20.270Z
Source SHA: 4e55173e67501c0185ef843886093008784dcbf6

conversations.info: HTTP 200; ok. Token and channel ID omitted.

```json
{
  "is_member": true,
  "is_channel": true,
  "is_archived": false,
  "is_shared": false,
  "is_ext_shared": false,
  "is_org_shared": false,
  "is_pending_ext_shared": false,
  "is_frozen": "absent"
}
```

Only the absent optional is_frozen is normalized to false under ct 20 Oct 19:12Z. Every other flag above was explicitly present with the value shown. No message or channel was created by this read.
