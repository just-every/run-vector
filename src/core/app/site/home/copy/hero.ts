// Every word the homepage hero says. Drawing strings are Vector's own labels (decision-panel, decision-confirmation,
// stream-list, streams/ui/helpers) and its sample workspace; keep them to what the product shows today.

export const hero = {
  title: 'Know what happens next.',
  titleLines: ['Know what', 'happens next.'],
  sub: "Every report gets a clear decision. Your team sees what's now, what's next, and why.",
  primary: 'Get the code',
  secondary: 'Read the docs',
  alternative: '100% free, open source alternative to Linear, Jira and Asana',
  // The names inside `alternative` that the page sets in bold; each appears there exactly once.
  alternativeNames: ['Linear', 'Jira', 'Asana'],
}

export const flow = {
  label: 'How a report moves through Vector',
  identifier: 'FLW-842',
  title: 'Webhook delivery retries exceed customer tolerance',
  report: { reason: 'Awaiting decision' },
  decision: { options: ['Accept', 'Defer', 'Decline'], chosen: 'Accept', saved: 'Accepted', actor: 'Sarah Chen' },
  captions: ['A report comes in', 'Someone makes the call'],
} as const

export const meta = {
  description: `${hero.alternative}. Know what happens next. Every report gets a clear decision, and Current shows your team what's now, what's next and why. 100% free and open source, MIT licensed.`,
}
