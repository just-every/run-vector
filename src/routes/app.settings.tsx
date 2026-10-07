import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "../core/features/settings/ui/settings-page";
export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});
