import {
  useId,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  canonicalMentionBody,
  editMentionText,
  type MentionEditorState,
} from "../../notifications/ui/mention-editor-state";
import {
  commands,
  languages,
  linkCommand,
  markdownCommand,
  slashQuery,
  type MarkdownChange,
  type Selection,
} from "./commands";
import { MarkdownLinkForm, MarkdownMenu, MarkdownToolbar } from "./controls";
import { pasteMarkdown } from "./paste";
import { selectedTable, tableChange, type TableAction } from "./table";
import "./editor.css";

type Draft = { state: MentionEditorState; range: Selection };
export function useMarkdownAuthoring({
  state,
  publish,
  textarea,
  caret,
  setCaret,
  disabled,
  maxLength,
}: {
  state: MentionEditorState;
  publish: (state: MentionEditorState) => void;
  textarea: RefObject<HTMLTextAreaElement | null>;
  caret: number | null;
  setCaret: (caret: number | null) => void;
  disabled: boolean;
  maxLength?: number;
}) {
  const id = useId();
  const [panel, setPanel] = useState<
    "menu" | "language" | "link" | "issue" | null
  >(null);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [notice, setNotice] = useState("");
  const draft = useRef<Draft | null>(null);
  const draftSource = useRef(state);
  const pendingSelection = useRef<Selection | null>(null);
  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    if (!selection || !textarea.current) return;
    pendingSelection.current = null;
    textarea.current.focus();
    textarea.current.setSelectionRange(selection.start, selection.end);
  });
  useEffect(() => {
    if (draft.current && draftSource.current !== state) {
      draft.current = null;
      setPanel(null);
    }
  }, [state]);
  const range = () => ({
    start: textarea.current?.selectionStart ?? state.text.length,
    end: textarea.current?.selectionEnd ?? state.text.length,
  });
  const slash =
    caret === null || dismissed || panel || disabled
      ? null
      : slashQuery(state.text, caret);
  const menu = panel === "menu" || panel === "language" || !!slash;
  const filter = (slash?.query ?? search).toLocaleLowerCase();
  const items = (
    panel === "language"
      ? languages.map((language) => ({
          id: language,
          label: language,
          keywords: "",
        }))
      : commands
  ).filter(
    (command) =>
      `${command.label} ${command.keywords ?? ""}`
        .toLocaleLowerCase()
        .includes(filter) || command.id === filter,
  );
  items.sort((a, b) => Number(b.id === filter) - Number(a.id === filter));
  const current = Math.min(active, Math.max(0, items.length - 1));
  function restore(selection: Selection) {
    pendingSelection.current = selection;
    setCaret(selection.end);
  }
  function close() {
    setPanel(null);
    setDismissed(true);
    setSearch("");
    setActive(0);
    restore(draft.current?.range ?? range());
    draft.current = null;
  }
  function apply(change: MarkdownChange, base = state) {
    if (disabled) return;
    let next = base;
    for (const edit of change.edits)
      next = editMentionText(
        next,
        next.text.slice(0, edit.start) + edit.text + next.text.slice(edit.end),
        { start: edit.start, end: edit.end, inputType: "insertText" },
      );
    if (
      maxLength !== undefined &&
      canonicalMentionBody(next).length > maxLength
    ) {
      setNotice(
        `This edit exceeds the ${maxLength.toLocaleString()} character limit.`,
      );
      return;
    }
    publish(next);
    setPanel(null);
    setDismissed(true);
    setSearch("");
    setActive(0);
    draft.current = null;
    setNotice("");
    restore(change.selection);
  }
  function prepare(): Draft {
    if (draft.current) return draft.current;
    if (!slash) return { state, range: range() };
    return {
      state: editMentionText(
        state,
        state.text.slice(0, slash.start) + state.text.slice(slash.end),
        {
          start: slash.start,
          end: slash.end,
          inputType: "deleteContentBackward",
        },
      ),
      range: { start: slash.start, end: slash.start },
    };
  }
  function command(commandId: string) {
    if (disabled) return;
    const prepared = prepare();
    if (commandId === "mention") {
      apply(
        {
          edits: [{ ...prepared.range, text: "@" }],
          selection: {
            start: prepared.range.start + 1,
            end: prepared.range.start + 1,
          },
        },
        prepared.state,
      );
      return;
    }
    if (
      commandId === "menu" ||
      commandId === "code" ||
      commandId === "link" ||
      commandId === "issue"
    ) {
      draft.current = prepared;
      draftSource.current = state;
      setSearch("");
      setActive(0);
      setPanel(
        commandId === "menu"
          ? "menu"
          : commandId === "code"
            ? "language"
            : commandId,
      );
      return;
    }
    apply(
      markdownCommand(commandId, prepared.state.text, prepared.range),
      prepared.state,
    );
  }
  function choose(commandId: string) {
    if (panel === "language") {
      const prepared = prepare();
      apply(
        markdownCommand("code", prepared.state.text, prepared.range, commandId),
        prepared.state,
      );
    } else command(commandId);
  }
  function onMenuKeyDown(event: KeyboardEvent) {
    if (!menu || event.nativeEvent.isComposing) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return true;
    }
    if (event.key === "Tab") {
      setPanel(null);
      setDismissed(true);
      draft.current = null;
      return false;
    }
    if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key) && items.length) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter") choose(items[current].id);
      else
        setActive(
          (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length,
        );
      return true;
    }
    return false;
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (disabled || event.nativeEvent.isComposing || event.defaultPrevented)
      return false;
    if (onMenuKeyDown(event)) return true;
    if (event.metaKey || event.ctrlKey) {
      const key = event.key.toLowerCase();
      const action =
        event.shiftKey && event.code === "Digit7"
          ? "check"
          : event.shiftKey && event.code === "Digit8"
            ? "bullet"
            : !event.shiftKey
              ? (
                  { b: "bold", i: "italic", k: "link" } as Record<
                    string,
                    string
                  >
                )[key]
              : undefined;
      if (action) {
        event.preventDefault();
        command(action);
        return true;
      }
    }
    const selection = range();
    if (event.key === " " && selection.start === selection.end) {
      const start = state.text.lastIndexOf("\n", selection.start - 1) + 1;
      const line = state.text.slice(start, selection.start);
      if (/^[ \t]*\[\]$/.test(line)) {
        event.preventDefault();
        const position = selection.start - 2;
        apply({
          edits: [{ start: position, end: selection.start, text: "- [ ] " }],
          selection: { start: position + 6, end: position + 6 },
        });
        return true;
      }
    }
    return false;
  }
  function onEdit() {
    setDismissed(false);
    setPanel(null);
    setSearch("");
    setActive(0);
    draft.current = null;
    setNotice("");
  }
  function editTable(action: TableAction) {
    const change = tableChange(state.text, range(), action);
    if (change) apply(change);
    else
      setNotice(
        "Keep the header and at least one column. Select a body row to delete it.",
      );
  }
  return {
    onKeyDown,
    onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) =>
      pasteMarkdown(event, { disabled, range, apply, setNotice }),
    onEdit,
    controls: (
      <MarkdownToolbar
        disabled={disabled}
        onCommand={command}
        table={caret !== null && !!selectedTable(state.text, range())}
        onTable={editTable}
      />
    ),
    panel: (
      <>
        {menu && (
          <span onKeyDown={onMenuKeyDown}>
            <MarkdownMenu
              id={id}
              items={items}
              active={current}
              onChoose={choose}
              onClose={close}
              languages={panel === "language"}
              search={search}
              onSearch={
                panel
                  ? (value) => {
                      setSearch(value);
                      setActive(0);
                    }
                  : undefined
              }
            />
          </span>
        )}
        {(panel === "link" || panel === "issue") && (
          <MarkdownLinkForm
            key={panel}
            issue={panel === "issue"}
            onClose={close}
            onInsert={(href, label) => {
              const prepared = prepare();
              apply(linkCommand(prepared.range, label, href), prepared.state);
            }}
          />
        )}
        {notice && (
          <span className="markdown-editor-notice" role="status">
            {notice}
          </span>
        )}
      </>
    ),
    menuId: slash && items.length ? id : undefined,
    activeId: slash && items.length ? `${id}-${current}` : undefined,
  };
}
