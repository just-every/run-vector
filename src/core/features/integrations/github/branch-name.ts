/** A suggestion only: generating a name never writes to the provider. */
export function githubBranchName(identifier: string, title: string) {
  const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/g, '');
  return identifier.toLowerCase() + (slug ? '-' + slug : '');
}
