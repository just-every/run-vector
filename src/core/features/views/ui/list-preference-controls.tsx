export type ListPreferenceControlsProps = {
  ready: boolean;
  loading: boolean;
  saving: boolean;
  loadError: Error | null;
  saveError: Error | null;
  onRetryLoad: () => void;
  onRetrySave: () => void;
  onReset: () => void;
  resetLabel?: string;
};

export function ListPreferenceControls({
  ready,
  loading,
  saving,
  loadError,
  saveError,
  onRetryLoad,
  onRetrySave,
  onReset,
  resetLabel = "Reset filters",
}: ListPreferenceControlsProps) {
  return (
    <div className="list-preference-controls">
      {loading ? (
        <span role="status">Loading saved controls…</span>
      ) : null}
      {saving ? <span role="status">Saving controls…</span> : null}
      {loadError ? (
        <span role="alert">
          Saved controls could not be loaded: {loadError.message}{" "}
          <button type="button" onClick={onRetryLoad}>
            Retry loading controls
          </button>
        </span>
      ) : null}
      {saveError ? (
        <span role="alert">
          Saved controls could not be saved: {saveError.message}{" "}
          <button type="button" onClick={onRetrySave}>
            Retry saving controls
          </button>
        </span>
      ) : null}
      <button
        type="button"
        disabled={!ready && loadError === null}
        onClick={onReset}
      >
        {resetLabel}
      </button>
    </div>
  );
}
