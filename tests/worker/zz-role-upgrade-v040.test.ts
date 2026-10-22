import { it } from "vitest";
import { proveRoleUpgrade } from "./role-upgrade-proof";
it("released v0.4.0 (0001-0072) populated store upgrades through 0073-0077", async () => proveRoleUpgrade("0073_channel_notifications.sql"), 180000);
