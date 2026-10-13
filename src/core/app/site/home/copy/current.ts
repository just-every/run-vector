// Section 2. Strings in the drawing are Current's own section names, reason labels (streams/ui/helpers) and sample issues.

export const current = {
  title: "Every issue says why it's there.",
  body: 'Current is the one list your whole team shares. Each issue in it sits in exactly one section, ordered by priority and then due date. No hidden score.',
  key: [
    { lead: 'Needs decision.', line: 'Reports waiting for someone to make the call.' },
    { lead: 'Now.', line: 'Work that has started, or is past its due date.' },
    { lead: 'Next.', line: 'Committed to this cycle or the next, or due within 7 days.' },
    { lead: 'Recently done.', line: 'Finished in the last 7 days.' },
  ],
  drawing: {
    label: 'Current once FLW-842 is accepted: nothing waiting for a decision, FLW-840 and FLW-842 in Now, FLW-841 in Next and PLT-104 recently done',
    title: 'Current',
    empty: 'Nothing in this section.',
    sections: [
      { name: 'Needs decision', rows: [] },
      { name: 'Now', rows: [{ id: 'FLW-840', reason: 'Overdue' }, { id: 'FLW-842', reason: 'Started work' }] },
      { name: 'Next', rows: [{ id: 'FLW-841', reason: 'Due within 7 days', context: 'Unassigned urgent work' }] },
      { name: 'Recently done', rows: [{ id: 'PLT-104', reason: 'Completed this week' }] },
    ],
  },
} as const
