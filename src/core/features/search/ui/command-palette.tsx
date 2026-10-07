import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "../../../app/api-client";
import { movePaletteHighlight } from "./command-helpers";
import {
  paletteEntries,
  workspaceSearchSchema,
  type PaletteEntry,
} from "./data";

type CommandPaletteProps = { onDismiss: () => void };

export function CommandPalette({ onDismiss }: CommandPaletteProps) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<ReturnType<
    typeof workspaceSearchSchema.parse
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entries = useMemo(() => paletteEntries(search, query), [query, search]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setActiveIndex((current) =>
      Math.min(Math.max(current, 0), Math.max(entries.length - 1, 0)),
    );
  }, [entries.length]);
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setSearch(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchJson(
      `/api/search?q=${encodeURIComponent(term)}`,
      workspaceSearchSchema,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setSearch(result);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to search the workspace.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  const select = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    if (
      entry.destination === "/app/issues/$identifier" &&
      entry.params &&
      "identifier" in entry.params
    )
      navigate({ to: entry.destination, params: entry.params });
    else if (
      entry.destination === "/app/projects/$projectId" &&
      entry.params &&
      "projectId" in entry.params
    )
      navigate({ to: entry.destination, params: entry.params });
    else navigate({ to: entry.destination });
    onDismiss();
  };

  const keyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        movePaletteHighlight(
          current,
          event.key === "ArrowDown" ? "next" : "previous",
          entries.length,
        ),
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      select(entries[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
      return;
    }
    if (event.key === "Tab") trapFocus(event, dialogRef.current);
  };

  const grouped = groupEntries(entries);
  return (
    <dialog
      className="command-palette"
      ref={dialogRef}
      open
      aria-modal="true"
      aria-labelledby="command-palette-title"
      onKeyDown={keyDown}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div className="command-palette__panel">
        <div className="command-palette__search">
          <span aria-hidden="true">⌕</span>
          <label>
            <span className="visually-hidden">
              Search issues, projects, and commands
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search issues, projects, commands…"
              aria-controls="command-palette-results"
              aria-activedescendant={
                entries[activeIndex]
                  ? `palette-${entries[activeIndex].id}`
                  : undefined
              }
            />
          </label>
          <kbd>Esc</kbd>
        </div>
        <h2 id="command-palette-title" className="visually-hidden">
          Command palette
        </h2>
        <div
          id="command-palette-results"
          className="command-palette__results"
          role="listbox"
          aria-label="Command palette results"
          aria-busy={loading}
        >
          {error ? (
            <p className="command-palette__message" role="alert">
              {error}
            </p>
          ) : null}
          {!error && entries.length === 0 && !loading ? (
            <p className="command-palette__message">
              No available records or commands match “{query}”.
            </p>
          ) : null}
          {grouped.map(([group, groupEntries]) => (
            <section key={group} aria-labelledby={`palette-group-${group}`}>
              <h3 id={`palette-group-${group}`}>{group}</h3>
              {groupEntries.map(({ entry, index }) => (
                <button
                  id={`palette-${entry.id}`}
                  key={entry.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? "is-active" : ""}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => select(entry)}
                >
                  <span>
                    <strong>{entry.title}</strong>
                    <small>{entry.detail}</small>
                  </span>
                  <span aria-hidden="true">↵</span>
                </button>
              ))}
            </section>
          ))}
        </div>
        <footer>
          <span>↑ ↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </footer>
      </div>
    </dialog>
  );
}

function groupEntries(entries: PaletteEntry[]) {
  const groups = new Map<
    string,
    Array<{ entry: PaletteEntry; index: number }>
  >();
  entries.forEach((entry, index) =>
    groups.set(entry.group, [
      ...(groups.get(entry.group) ?? []),
      { entry, index },
    ]),
  );
  return [...groups.entries()];
}

function trapFocus(
  event: React.KeyboardEvent<HTMLDialogElement>,
  dialog: HTMLDialogElement | null,
) {
  if (!dialog) return;
  const focusable = [
    ...dialog.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), [href]",
    ),
  ].filter((element) => element.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
