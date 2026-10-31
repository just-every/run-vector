import type {WorkspaceOptions} from "../../../shared/workspace-options";
import type {NewIssueDraft} from "./new-issue-draft";

/** User edits, including explicit blanks, take precedence over team defaults. */
export function prefillTeamTemplate(draft:NewIssueDraft,team:WorkspaceOptions['teams'][number]|undefined,edited:ReadonlySet<string>):Partial<NewIssueDraft> {
 const template=team?.defaultIssueTemplate;
 if(!template)return {};
 return {
  title:edited.has('title') ? draft.title : template.title,
  description:edited.has('description') ? draft.description : template.description,
  priority:edited.has('priority') ? draft.priority : template.priority,
  estimate:edited.has('estimate') ? draft.estimate : (team.estimatesEnabled && template.estimate !== null ? String(template.estimate) : ''),
  labelIds:edited.has('labelIds') ? draft.labelIds : template.labelIds,
 };
}
