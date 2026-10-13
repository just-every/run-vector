// Section 4. FLW-842 is the intake issue the sample workspace deferred; the drawing follows it out and back.

export const later = {
  title: 'Later gets a date.',
  body: 'Not ready to decide? Defer it to a date and time. It comes back to Needs decision then, with a note in your Inbox, or sooner if new evidence arrives.',
  drawing: {
    label: 'FLW-842 deferred on Monday 12 October until 18 October at 09:00 AM, then back in Needs decision',
    identifier: 'FLW-842',
    title: 'Webhook delivery retries exceed customer tolerance',
    options: ['Accept', 'Defer', 'Decline'],
    chosen: 'Defer',
    field: 'Return for decision',
    value: '10/18/2026, 09:00 AM',
    saved: 'Deferred',
    actor: 'Sarah Chen',
    days: [12, 13, 14, 15, 16, 17, 18],
    time: '09:00 AM',
    section: 'Needs decision',
    reason: 'Awaiting decision',
  },
}
