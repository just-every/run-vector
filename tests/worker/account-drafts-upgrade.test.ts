import { it } from 'vitest';
import { provePopulatedUpgrade } from './populated-upgrade';

it('[ISSUE-028 DATA-005] adding account drafts preserves the populated installation and its native archive', async () => {
  await provePopulatedUpgrade('0121_issue_drafts.sql', {
    until: '0122_comment_drafts.sql', added: ['table issue_drafts', 'index issue_drafts_author', 'table comment_drafts', 'index comment_drafts_author', 'index comment_drafts_composer'], removed: [],
  });
}, 180_000);
