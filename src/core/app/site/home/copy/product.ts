// Section 5. Every drawing string is a label Vector shows (projects service, cycle row, issue-detail, command palette).

export const product = {
  title: 'The rest of your tracker',
  body: 'My work, Issues, a Board, Projects, Cycles, saved views, Search and an Inbox are all in the same free code.',
  projects: {
    title: 'Projects',
    line: 'Health with a reason: the exact issue putting a project at risk.',
    label: 'The Customer Reliability project, at risk because urgent FLW-841 is unassigned',
    project: 'Customer Reliability',
    health: 'At risk',
    risk: 'Urgent work is unassigned:',
    identifier: 'FLW-841',
    issue: 'Define webhook delivery error budget',
    meta: 'Todo · Unassigned',
  },
  cycles: {
    title: 'Cycles',
    line: 'When a cycle ends, unfinished work rolls into the next one.',
    label: "The Flow team's Reliability response cycle, half done and within capacity",
    cycle: 'Flow · Reliability response',
    progress: '6/12 points · 50%',
    capacity: 'Within capacity',
    percent: 50,
  },
  history: {
    title: 'History',
    line: 'Every change and decision is kept, with who made it and when.',
    label: "An issue's decision history: deferred by Sarah Chen eight days ago, then accepted by her two days ago",
    head: 'Decision history',
    rows: [
      { kind: 'deferred', actor: 'Sarah Chen', when: '8d ago', done: false },
      { kind: 'accepted', actor: 'Sarah Chen', when: '2d ago', done: true },
    ],
  },
  search: {
    title: 'Search',
    line: 'Press ⌘K and jump to any issue by its identifier or its words.',
    label: 'Search opened with Command K, finding two issues for "delivery"',
    keys: ['⌘', 'K'],
    query: 'delivery',
    esc: 'Esc',
    group: 'Issues',
    kind: 'Issue',
    results: [
      { id: 'FLW-841', title: 'Define webhook delivery error budget', selected: true },
      { id: 'FLW-842', title: 'Webhook delivery retries exceed customer tolerance', selected: false },
    ],
  },
} as const
