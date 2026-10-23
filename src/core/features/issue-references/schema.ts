export type IssueReference = {
  identifier: string;
  title: string;
  status: { id: string; name: string; category: string };
};
export type IssueReferencesResponse = { references: IssueReference[] };
export const issueIdentifierPattern = /^[A-Z][A-Z0-9_]{0,99}-[1-9][0-9]*$/;
