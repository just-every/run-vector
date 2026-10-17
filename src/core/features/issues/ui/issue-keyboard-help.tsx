import { IssueKeyboardModal } from "./issue-keyboard-modal";

export function IssueKeyboardHelp({ onClose }: { onClose: () => void }) {
  return (
    <IssueKeyboardModal title="Issue keyboard shortcuts" onClose={onClose}>
      <p>Property shortcuts act on selected issues, or the focused row when nothing is selected. Typing in a field keeps its normal behavior.</p>
      <dl className="issue-keyboard-help">
        <dt>↑ / ↓</dt><dd>Move focus through the rendered list</dd>
        <dt>X</dt><dd>Toggle the focused issue’s selection</dd>
        <dt>Enter / Escape</dt><dd>Open an issue / return to its row</dd>
        <dt>S / A / P</dt><dd>Change status / assignee / priority</dd>
        <dt>L / E / D</dt><dd>Replace labels / set estimate / set due date</dd>
        <dt>M</dt><dd>Move selected issues to another team</dd>
        <dt>Shift-D</dt><dd>Mark selected issues as duplicates or remove their duplicate decisions</dd>
        <dt>Command/Ctrl-.</dt><dd>Copy branch names, one line per issue</dd>
        <dt>?</dt><dd>Show this help</dd>
      </dl>
      <p>Status changes require a workflow status valid for every selected issue. Team moves require an explicit destination status for each category. Selected changes succeed together or leave every issue unchanged.</p>
    </IssueKeyboardModal>
  );
}
