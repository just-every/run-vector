import './resource-state.css';

export function MissingResource({ kind, back, list }: {
  kind: 'project' | 'saved view' | 'issue' | 'initiative' | 'release' | 'cycle' | 'team';
  back: string;
  list: string;
}) {
  return <main className="resource-state">
    <h1>This {kind} does not exist.</h1>
    <a href={back}>Back to {list}</a>
  </main>;
}

export function FailedResource({ kind, retry }: { kind: string; retry: () => void }) {
  return <main className="resource-state" role="alert">
    <p>This {kind} could not be loaded.</p>
    <button type="button" onClick={retry}>Retry</button>
  </main>;
}
