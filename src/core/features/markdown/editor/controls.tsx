import { ScopedTooltip } from '../../../ui/tooltip';
import { useEffect, useRef, useState } from "react";
import type { Command } from "./commands";
import type { TableAction } from "./table";
import { safeEditorLink } from "./paste";

export function MarkdownToolbar({
  disabled,
  onCommand,
  table,
  onTable,
}: {
  disabled: boolean;
  onCommand: (id: string) => void;
  table: boolean;
  onTable: (action: TableAction) => void;
}) {
  return (
    <span
      className="markdown-toolbar"
      role="group"
      aria-label="Markdown formatting"
    >
      {[
        ["bold", "Bold", "B"],
        ["italic", "Italic", "I"],
        ["strike", "Strikethrough", "S"],
        ["inline-code", "Inline code", "Code"],
        ["link", "Insert link", "Link"],
        ["menu", "Insert Markdown", "+ Insert"],
      ].map(([id, label, text]) => (
        <ScopedTooltip key={id} label={label}><button
          type="button"
          disabled={disabled}
          aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            onCommand(id);
          }}
        >
          {text}
        </button></ScopedTooltip>
      ))}
      {table && (
        <span
          className="markdown-table-controls"
          role="group"
          aria-label="Edit selected table"
        >
          {[
            ["row", "Add row"],
            ["column", "Add column"],
            ["remove-row", "Delete row"],
            ["remove-column", "Delete column"],
          ].map(([action, label]) => (
            <button
              key={action}
              type="button"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                onTable(action as TableAction);
              }}
            >
              {label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
export function MarkdownMenu({
  id,
  items,
  active,
  onChoose,
  onClose,
  search,
  onSearch,
  languages,
}: {
  id: string;
  items: Command[];
  active: number;
  onChoose: (id: string) => void;
  onClose: () => void;
  search?: string;
  onSearch?: (value: string) => void;
  languages: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (onSearch) input.current?.focus();
  }, [onSearch !== undefined, languages]);
  useEffect(() => {
    document
      .getElementById(`${id}-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, id]);
  return (
    <span className="markdown-menu">
      {onSearch && (
        <input
          ref={input}
          className="markdown-menu-search"
          aria-label={
            languages ? "Find code language" : "Find Markdown command"
          }
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          autoComplete="off"
          aria-controls={id}
          aria-activedescendant={items.length ? `${id}-${active}` : undefined}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
        />
      )}
      <span
        role="listbox"
        id={id}
        aria-label={languages ? "Code language" : "Markdown commands"}
        className="markdown-menu-options"
      >
        {items.map((item, index) => (
          <button
            type="button"
            role="option"
            key={item.id}
            id={`${id}-${index}`}
            aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              onChoose(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </span>
      {!items.length && <span role="status">No matching commands.</span>}
      <span className="markdown-editor-help">
        ↑ ↓ choose · Enter inserts · Escape closes
      </span>
    </span>
  );
}
export function MarkdownLinkForm({
  issue,
  onInsert,
  onClose,
}: {
  issue: boolean;
  onInsert: (href: string, label: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  function insert() {
    const raw = value.trim();
    const href = issue ? `/app/issues/${raw.toUpperCase()}` : raw;
    if (
      (issue && !/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(raw)) ||
      !safeEditorLink(href)
    ) {
      setError(
        issue
          ? "Enter an issue identifier, for example VEC-12."
          : "Enter an HTTPS URL, issue path or #anchor.",
      );
      return;
    }
    onInsert(
      href,
      label.trim().replace(/[\[\]\\\r\n]/g, "") ||
        (issue ? raw.toUpperCase() : "Link"),
    );
  }
  return (
    <span
      className="markdown-link-form"
      role="group"
      aria-label={issue ? "Insert issue link" : "Insert link"}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          insert();
        }
      }}
    >
      <input
        ref={input}
        aria-label={issue ? "Issue identifier" : "Link URL"}
        placeholder={issue ? "VEC-12" : "https://"}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError("");
        }}
      />
      <input
        aria-label="Link text (uses selected text when present)"
        placeholder="Link text"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          insert();
        }}
      >
        Insert link
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        Cancel
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
