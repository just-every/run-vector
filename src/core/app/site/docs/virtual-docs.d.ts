// The module build/plugin.ts generates from docs/site.json and the Markdown it names.
declare module 'virtual:vector-docs' {
  export const sections: import('./types').DocsSection[];
  export const bodies: Record<string, import('./types').DocsBody>;
}
