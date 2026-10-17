import { createContext, useContext, useState } from 'react';
import { useHydrated } from '../../../app/initial-resources';
export type TaskChange = { index: number; text: string; checked: boolean };
export const MarkdownTasks = createContext<{ tasks: { text: string }[]; busy: boolean; onChange?: (task: TaskChange) => void | Promise<void> }>({ tasks: [], busy: false });
/** Keep the input's component identity through a pending save and its receipt. */
export function TaskCheckbox({ node, checked }: { node?: { properties?: Record<string, unknown> }; checked?: boolean }) {
  const context = useContext(MarkdownTasks), hydrated = useHydrated();
  const [pending, setPending] = useState<boolean | null>(null);
  const index = Number(node?.properties?.['data-task-index']), task = context.tasks[index];
  return <label className="markdown-task-toggle"><input type="checkbox" checked={pending ?? Boolean(checked)} disabled={pending !== null || !hydrated || context.busy || !context.onChange || !task} aria-label={task?.text || 'Checklist item'} onChange={async event => {
    if (!task || !context.onChange) return;
    const checked = event.target.checked; setPending(checked);
    try { await context.onChange({ index, text: task.text, checked }); }
    finally { setPending(null); }
  }} /></label>;
}
