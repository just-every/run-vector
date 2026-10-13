import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ListPreferenceControls } from "../src/core/features/views/ui/list-preference-controls.tsx";

test("[VIEW-003] list controls expose a visible reset and retries for load and save errors", () => {
  const html = renderToStaticMarkup(
    <ListPreferenceControls
      ready={false}
      loading={false}
      saving={false}
      loadError={new Error("preferences unavailable")}
      saveError={new Error("write rejected")}
      onRetryLoad={() => {}}
      onRetrySave={() => {}}
      onReset={() => {}}
    />,
  );

  assert.match(html, /role="alert"[^>]*>Saved controls could not be loaded/);
  assert.match(html, /Retry loading controls/);
  assert.match(html, /Saved controls could not be saved/);
  assert.match(html, /Retry saving controls/);
  assert.match(html, /<button type="button">Reset filters<\/button>/);
  const loading = renderToStaticMarkup(
    <ListPreferenceControls
      ready={false}
      loading
      saving={false}
      loadError={null}
      saveError={null}
      onRetryLoad={() => {}}
      onRetrySave={() => {}}
      onReset={() => {}}
    />,
  );
  assert.match(loading, /<button type="button" disabled="">Reset filters<\/button>/);
});
