import assert from "node:assert/strict";
import test from "node:test";
import { isViteDevelopmentAsset } from "../src/core/app/vite-development-path.ts";
test("BASE-SECRET-001 notification UI admits only its reviewed client modules", () => {
  for (const path of [
    "ui/inbox-page.tsx",
    "ui/notifications-panel.tsx",
    "ui/mention-textarea.tsx",
    "mention-token.ts",
    "mention-markdown.ts",
    "schema.ts",
  ])
    assert.equal(
      isViteDevelopmentAsset("/src/core/features/notifications/" + path),
      true,
    );
  for (const path of [
    "mentions.server.ts",
    "repository.ts",
    "routes.ts",
    "mail.ts",
    "events.ts",
    "unreviewed.ts",
  ])
    assert.equal(
      isViteDevelopmentAsset("/src/core/features/notifications/" + path),
      false,
    );
});
