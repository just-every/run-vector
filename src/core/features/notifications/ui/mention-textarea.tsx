import {
  useEffect,
  useId,
  useRef,
  useState,
  type TextareaHTMLAttributes,
} from "react";
import { useMentionOperators } from "./mention-operators";
import { useMarkdownAuthoring } from "../../markdown/editor/use-markdown-authoring";
import {
  canonicalMentionBody,
  editMentionText,
  mentionQuery,
  projectMentionBody,
  reprojectMentionCaret,
  selectEditorMention,
} from "./mention-editor-state";
import "./notifications.css";
type Props = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (body: string) => void;
};

export function MentionSuggestionOption({
  operator,
  optionId,
  selected,
  onChoose,
}: {
  operator: { id: string; name: string };
  optionId: string;
  selected: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      id={optionId}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onChoose}
    >
      <span>{operator.name}</span>
    </button>
  );
}

export function MentionTextarea({
  value,
  defaultValue = "",
  onValueChange,
  ...props
}: Props) {
  const options = useMentionOperators();
  if (!options) throw new Error("Mention operators provider is required");
  const operatorIds =
    options.data?.operators.map((operator) => operator.id) ?? [];
  const signature = operatorIds.join(",");
  const previousOperators = useRef(signature);
  const [state, setState] = useState(() =>
    projectMentionBody(value ?? defaultValue, operatorIds),
  );
  const [caret, setCaret] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const source = useRef(value ?? defaultValue);
  const editRange = useRef<
    { start: number; end: number; inputType: string } | undefined
  >(undefined);
  useEffect(() => {
    const field = textarea.current;
    if (!field) return;
    const beforeInput = (event: Event) => {
      editRange.current = {
        start: field.selectionStart,
        end: field.selectionEnd,
        inputType: (event as InputEvent).inputType,
      };
    };
    field.addEventListener("beforeinput", beforeInput);
    return () => field.removeEventListener("beforeinput", beforeInput);
  }, []);
  if (
    (value !== undefined && value !== source.current) ||
    previousOperators.current !== signature
  ) {
    const body =
      value !== undefined && value !== source.current
        ? value
        : canonicalMentionBody(state);
    source.current = body;
    previousOperators.current = signature;
    const next = projectMentionBody(body, operatorIds);
    if (
      typeof document !== "undefined" &&
      textarea.current === document.activeElement &&
      textarea.current
    ) {
      const start = reprojectMentionCaret(
        state,
        next,
        textarea.current.selectionStart,
      );
      const end = reprojectMentionCaret(
        state,
        next,
        textarea.current.selectionEnd,
      );
      if (caret !== null) setCaret(start);
      requestAnimationFrame(() =>
        textarea.current?.setSelectionRange(start, end),
      );
    }
    setState(next);
  }
  const query = caret === null ? null : mentionQuery(state.text, caret);
  const matches =
    options.data?.operators
      .filter((operator) =>
        operator.name
          .toLocaleLowerCase()
          .includes(query?.query.toLocaleLowerCase() ?? ""),
      )
      .slice(0, 8) ?? [];
  const listId = useId();
  const active = Math.min(selected, Math.max(0, matches.length - 1));
  useEffect(() => {
    if (query && matches.length)
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, listId, query?.start, query?.end, matches.length]);
  const publish = (next: typeof state) => {
    const body = canonicalMentionBody(next);
    source.current = body;
    setState(next);
    onValueChange?.(body);
  };
  const authoring = useMarkdownAuthoring({
    state,
    publish,
    textarea,
    caret,
    setCaret,
    disabled: Boolean(props.disabled || props.readOnly),
    maxLength: props.maxLength,
  });
  function choose(index: number) {
    if (!query || !matches[index]) return;
    const next = selectEditorMention(
      state,
      query.start,
      query.end,
      matches[index],
    );
    publish(next);
    setCaret(null);
    const position = query.start + matches[index].name.length + 2;
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(position, position);
    });
  }
  return (
    <span className="mention-editor">
      {authoring.controls}
      <textarea
        {...props}
        ref={textarea}
        value={state.text}
        data-canonical-body={canonicalMentionBody(state)}
        aria-controls={
          authoring.menuId ?? (query && matches.length ? listId : undefined)
        }
        aria-autocomplete="list"
        aria-activedescendant={
          authoring.activeId ??
          (query && matches.length ? `${listId}-${active}` : undefined)
        }
        aria-describedby={
          [props["aria-describedby"], query ? `${listId}-help` : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onChange={(event) => {
          authoring.onEdit();
          publish(
            editMentionText(state, event.target.value, editRange.current),
          );
          editRange.current = undefined;
          setCaret(event.target.selectionStart);
          setSelected(0);
        }}
        onPaste={(event) => {
          props.onPaste?.(event);
          authoring.onPaste(event);
        }}
        onSelect={(event) => {
          props.onSelect?.(event);
          if (event.currentTarget === document.activeElement)
            setCaret(event.currentTarget.selectionStart);
        }}
        onBlur={(event) => {
          props.onBlur?.(event);
          const target = event.relatedTarget as HTMLElement | null;
          // Keep the in-flow panel steady until the form button receives its click.
          if (
            target?.tagName === "BUTTON" &&
            event.currentTarget.closest("form")?.contains(target)
          )
            return;
          if (!target || !event.currentTarget.parentElement?.contains(target))
            setCaret(null);
        }}
        onKeyDown={(event) => {
          if (authoring.onKeyDown(event)) return;
          props.onKeyDown?.(event);
          if (event.defaultPrevented || !query || event.nativeEvent.isComposing)
            return;
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setCaret(null);
          }
          if (event.key === "Tab") setCaret(null);
          if (
            matches.length &&
            ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)
          ) {
            event.preventDefault();
            if (event.key === "Enter") choose(active);
            else
              setSelected(
                (active +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  matches.length) %
                  matches.length,
              );
          }
        }}
      />
      {authoring.panel}
      {query && (
        <span className="mention-suggestions">
          {options.loading && <span role="status">Loading operators…</span>}
          {options.error && (
            <span role="alert">
              Unable to load operators.{" "}
              <button type="button" onClick={options.reload}>
                Retry mentions
              </button>
            </span>
          )}
          {!options.loading && !options.error && matches.length === 0 && (
            <span role="status">No matching operators.</span>
          )}
          {matches.length > 0 && (
            <span
              className="mention-options"
              id={listId}
              role="listbox"
              aria-label="Mention an operator"
            >
              {matches.map((operator, index) => (
                <MentionSuggestionOption
                  key={operator.id}
                  operator={operator}
                  optionId={`${listId}-${index}`}
                  selected={index === active}
                  onChoose={() => choose(index)}
                />
              ))}
            </span>
          )}
          <span className="mention-help" id={`${listId}-help`}>
            {matches.length > 0
              ? "↑ ↓ choose · Enter inserts · Escape closes"
              : !options.loading && !options.error
                ? "Unmatched text stays literal · Escape closes"
                : "Escape closes"}
          </span>
        </span>
      )}
    </span>
  );
}
