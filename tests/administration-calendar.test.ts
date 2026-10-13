import assert from "node:assert/strict";
import { contract } from "./contract.ts";
import { localTimeToInstant } from "../src/core/features/administration/calendar.ts";
import {
  labelTextColor,
  teamCreateSchema,
  projectCreateSchema,
} from "../src/core/features/administration/schema.ts";
contract(
  "OPS-003 CYCLE-001",
  "workspace local time rejects gaps, ambiguous minutes and invalid dates",
  () => {
    assert.equal(
      localTimeToInstant("2026-10-08T10:15", "Australia/Brisbane"),
      "2026-10-08T00:15:00.000Z",
    );
    assert.equal(
      localTimeToInstant("2026-04-05T03:15", "Australia/Lord_Howe"),
      "2026-04-04T16:45:00.000Z",
    );
    assert.throws(
      () => localTimeToInstant("2026-03-08T02:30", "America/New_York"),
      /does not exist/,
    );
    assert.throws(
      () => localTimeToInstant("2026-11-01T01:30", "America/New_York"),
      /occurs twice/,
    );
    assert.throws(
      () => localTimeToInstant("2026-10-04T02:15", "Australia/Lord_Howe"),
      /does not exist/,
    );
    assert.throws(
      () => localTimeToInstant("2026-02-30T12:00", "UTC"),
      /valid calendar/,
    );
  },
);
contract(
  "TEAM-001 ISSUE-014 PROJ-001",
  "identity, colours and calendar inputs validate without client server imports",
  () => {
    for (const prefix of ["A", "ABCDEFGHIJK", "Ab", "A1", "A!", "A B", "ÄB"])
      assert.equal(
        teamCreateSchema.safeParse({ name: "Team", identifierPrefix: prefix })
          .success,
        false,
      );
    for (const prefix of ["AB", "ABCDEFGHIJ"])
      assert.equal(
        teamCreateSchema.safeParse({
          name: "  Team  ",
          identifierPrefix: prefix,
        }).success,
        true,
      );
    for (const color of [
      "#000000",
      "#ffffff",
      "#ff0000",
      "#008800",
      "#777777",
      "#123456",
    ]) {
      const values = [1, 3, 5]
        .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      const lum = values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      assert.ok(
        (labelTextColor(color) === "#000000"
          ? (lum + 0.05) / 0.05
          : 1.05 / (lum + 0.05)) >= 4.5,
      );
    }
    assert.throws(() => labelTextColor("red"));
    assert.equal(
      projectCreateSchema.safeParse({
        name: "P",
        leadOperatorId: "01J00000000000000000000001",
        targetDate: "2026-02-30",
      }).success,
      false,
    );
  },
);
