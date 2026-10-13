import type { ReactNode } from 'react';
import { SitePage } from '../shell/site-page';
import { DocsNav } from './docs-nav';

// The docs in the homepage's header, footer and type (12ui pick: evidence brand-vector-s3 12ui/pick-docs-A.png): the
// page list, the reading column and, on a page, its contents.
export function DocsLayout({ current, aside, children }: { current?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <SitePage current="docs" className="vx-docs-site">
      <div className="vx-wrap vx-docs-grid">
        <DocsNav current={current} />
        <div className="vx-docs-main">{children}</div>
        <aside className="vx-docs-aside">{aside}</aside>
      </div>
    </SitePage>
  );
}
