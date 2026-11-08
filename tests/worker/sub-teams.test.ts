import { it } from "vitest";
import { teamMembershipJourney } from "./team-membership-journey";
import {subTeamHierarchy} from "./sub-team-workflow-journey";
import {subTeamList} from "./sub-team-list-journey";

// This is the existing membership journey, extended with hierarchy and list
// outcomes. Its original assertions remain unconditional and unchanged.
it("[TEAM-006 TEAM-007 TEAM-008 ROLE-007 OPS-001] team hierarchy, membership, workflow and paged visible issues retain identity and current access", async () => {
  await teamMembershipJourney();
  await subTeamHierarchy();
  await subTeamList();
}, 120_000);
