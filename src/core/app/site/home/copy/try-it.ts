// Section 6. The commands are the README's pnpm scripts; the setup card is the first-run page (first-run/page.tsx).

export const tryIt = {
  title: 'Try it without switching.',
  intro: 'Run it on your computer next to the tracker you use today. It changes nothing there.',
  steps: [
    { lead: 'Run three commands.', line: "Open the link it prints and you're signed in." },
    { lead: 'Connect a source.', line: 'Reports from your monitoring or support tool land in Needs decision.' },
    { lead: 'Invite your team.', line: "Everyone sees the same list of what's now and next." },
  ],
  link: 'Read the installation guide',
  drawing: {
    label: 'Three commands in a terminal, and the screen they open: Finish setting up Vector',
    terminal: 'vector',
    commands: [
      'pnpm install --frozen-lockfile',
      'pnpm run setup -- --owner-email you@example.com --non-interactive',
      'pnpm run dev',
    ],
    kicker: 'Your workspace',
    heading: 'Finish setting up Vector',
    button: 'Open my workspace',
  },
}
