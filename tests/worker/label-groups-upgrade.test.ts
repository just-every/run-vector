import { it } from "vitest";
import { provePopulatedUpgrade } from "./populated-upgrade";

it("[ISSUE-014] a populated installation upgrades to label groups with every label and issue selection intact and still exports", async () => {
  await provePopulatedUpgrade("0121_label_groups.sql", {
    until: "0121_label_groups.sql", preserveAfter: "0121_label_groups.sql",
    added: ["table label_groups", "index labels_group_idx", "trigger label_group_workspace_insert", "trigger label_group_workspace_update", "trigger label_group_membership", "trigger issue_label_group_insert", "trigger issue_label_group_update"],
    changed: ["table labels"], removed: [],
  }, ["labels"]);
}, 180_000);
