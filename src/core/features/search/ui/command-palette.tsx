import { IssueCopyDialog } from "../../issue-copy/ui";
import { useRouterState } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "../../../app/api-client";
import { searchErrorMessage } from "./search-error";
import { movePaletteHighlight } from "./command-helpers";
import {
  paletteEntries,
  workspaceSearchSchema,
  type PaletteEntry,
} from "./data";

import { savedViewPaletteEntries } from "./saved-view-entries";

type CommandPaletteProps = { onDismiss: () => void };

export function CommandPalette({ onDismiss }: CommandPaletteProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const currentIdentifier = /^\/app\/issues\/([A-Z]{2,10}-[1-9][0-9]*)$/.exec(
    pathname,
  )?.[1];
  const [copyIdentifier, setCopyIdentifier] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<ReturnType<
    typeof workspaceSearchSchema.parse
  > | null>(null);
  const [resultTerm, setResultTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentSearch = resultTerm === query.trim() ? search : null;
  const entries = useMemo(
    () => [
      ...paletteEntries(currentSearch, query),
      ...copyPaletteEntries(currentIdentifier, currentSearch, query),
      ...savedViewPaletteEntries(currentSearch, query),
    ],
    [query, currentSearch, currentIdentifier],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = Math.max(
    entries.findIndex((entry) => entry.id === activeId),
    0,
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useLayoutEffect(() => {
    // Search results can arrive ahead of commands. Keep the selected identity,
    // rather than letting its previous position select an unrelated record.
    const selectedId = entries[activeIndex]?.id ?? null;
    if (selectedId !== activeId) setActiveId(selectedId);
    const results = resultsRef.current;
    const option = results?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    if (!results || !option) return;
    const viewport = results.getBoundingClientRect();
    const bounds = option.getBoundingClientRect();
    if (bounds.top < viewport.top)
      results.scrollTop += bounds.top - viewport.top;
    else if (bounds.bottom > viewport.bottom)
      results.scrollTop += bounds.bottom - viewport.bottom;
  }, [entries, activeId, activeIndex]);
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setSearch(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setSearch(null);
    setLoading(true);
    setError(null);
    void fetchJson(
      `/api/search?q=${encodeURIComponent(term)}`,
      workspaceSearchSchema,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setResultTerm(term);
          setSearch(result);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(searchErrorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  const select = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    if (
      entry.action === "copy-issue" &&
      entry.params &&
      "identifier" in entry.params
    ) {
      setCopyIdentifier(entry.params.identifier);
      return;
    }
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
    else if (
      entry.destination === "/app/views/$viewId" &&
      entry.params &&
      "viewId" in entry.params
    )
      navigate({ to: entry.destination, params: entry.params });
    else navigate({ to: entry.destination });
    onDismiss();
  };

  const keyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = movePaletteHighlight(
        activeIndex,
        event.key === "ArrowDown" ? "next" : "previous",
        entries.length,
      );
      setActiveId(entries[nextIndex]?.id ?? null);
      inputRef.current?.focus({ preventScroll: true });
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
  if (copyIdentifier)
    return <IssueCopyDialog identifier={copyIdentifier} onClose={onDismiss} />;
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
              maxLength={200}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveId(null);
                setSearch(null);
              }}
              placeholder="Search issues, projects, saved views, commands…"
              aria-describedby="command-palette-description"
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
        <p id="command-palette-description" className="visually-hidden">
          Search issues, projects, saved views, and available commands.
        </p>
        <h2 id="command-palette-title" className="visually-hidden">
          Command palette
        </h2>
        <div
          ref={resultsRef}
          id="command-palette-results"
          className="command-palette__results"
          // An empty listbox is invalid; the container holds only the message then.
          role={entries.length ? "listbox" : undefined}
          aria-label={entries.length ? "Command palette results" : undefined}
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
            <section
              key={group}
              role="group"
              aria-labelledby={`palette-group-${group.replaceAll(" ", "-")}`}
            >
              <h3
                id={`palette-group-${group.replaceAll(" ", "-")}`}
                aria-hidden="true"
              >
                {group}
              </h3>
              {groupEntries.map(({ entry, index }) => (
                <button
                  id={`palette-${entry.id}`}
                  key={entry.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? "is-active" : ""}
                  onMouseMove={() => setActiveId(entry.id)}
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

function copyPaletteEntries(
  identifier: string | undefined,
  search: ReturnType<typeof workspaceSearchSchema.parse> | null,
  query: string,
): PaletteEntry[] {
  const term = query.trim().toLocaleLowerCase();
  const targets = [
    ...(identifier ? [{ identifier, title: "Current issue" }] : []),
    ...(search?.issues ?? []),
  ];
  return targets
    .filter(
      (issue, index) =>
        targets.findIndex((other) => other.identifier === issue.identifier) ===
        index,
    )
    .filter(
      (issue) =>
        !term ||
        `copy issue ${issue.identifier} ${issue.title}`
          .toLocaleLowerCase()
          .includes(term),
    )
    .map((issue) => ({
      id: `copy:${issue.identifier}`,
      group: "Commands",
      title: `Copy issue ${issue.identifier}`,
      detail: issue.title,
      destination: "/app/issues/$identifier",
      params: { identifier: issue.identifier },
      action: "copy-issue",
    }));
}
