import type { Plugin } from 'vite';
import { buildDocs } from './site.ts';

// The docs, rendered from docs/site.json and the Markdown it names when Vite loads them, so neither the Worker nor the
// browser ever parses Markdown. `virtual:vector-docs` exports the sections (each page's title and summary) and every
// page's body HTML and contents list. A broken link, a missing file or an unclassified Markdown file fails the build.

export const docsModuleId = 'virtual:vector-docs';
const resolvedId = `\0${docsModuleId}`;

export function docsSite(): Plugin {
  let root = process.cwd();
  return {
    name: 'vector:docs',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === docsModuleId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      const site = buildDocs(root);
      for (const file of site.files) this.addWatchFile(file);
      return `export const sections = ${JSON.stringify(site.sections)};\nexport const bodies = ${JSON.stringify(site.bodies)};\n`;
    },
  };
}
