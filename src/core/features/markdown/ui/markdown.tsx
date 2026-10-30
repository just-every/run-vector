import { remarkDescriptionAnchors } from "../../discussion/anchors";
import { useIssueReferences } from '../../issue-references/ui/context';
import { remarkIssueReferences } from '../../issue-references/ui/remark';
import { Tooltip } from '../../../ui/tooltip';
import { useState, type ComponentProps } from "react";
import { MarkdownTasks, TaskCheckbox } from "./task-checkbox";
import remarkGfm from "remark-gfm";
import { parseTasks } from "../../description-history/tasks";
import { CodeBlock, HighlightedCode, remarkDetails, rehypeTaskIndices } from "./formatting";
import { useMentionOperators } from "../../notifications/ui/mention-operators";
import { remarkMentions } from "../../notifications/mention-markdown";
import Markdown, { type Components, type ExtraProps } from "react-markdown";

// User text cannot introduce a scheme, a network-path reference, or an encoded
// control character. The private routes below are the reviewed document routes;
// auth, API, assets, and generated-function endpoints are not navigation targets.
function safeUrl(value: string | undefined, image = false): string | undefined {
  if (!value || /[\u0000-\u0020\u007f-\u009f\\]/u.test(value)) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return undefined;
  }
  if (/[\u0000-\u0020\u007f-\u009f\\]/u.test(decoded)) return undefined;

  if (/^https:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" &&
        url.hostname &&
        !url.username &&
        !url.password
        ? url.href
        : undefined;
    } catch {
      return undefined;
    }
  }

  if (image) return undefined;
  if (value.startsWith("#")) return value;
  if (!value.startsWith("/") || value.startsWith("//") || /%2f/i.test(value))
    return undefined;
  const path = decoded.split(/[?#]/, 1)[0];
  if (path.split("/").some((segment) => segment === "." || segment === ".."))
    return undefined;
  if (
    !/^\/app(?:\/(?:current|my-work|issues|projects)(?:\/[^/]+)?|\/new-issue)?\/?$/.test(
      path,
    )
  ) {
    return undefined;
  }
  return value;
}

function RequestedImage({
  src,
  alt,
  title,
}: {
  src: string;
  alt: string;
  title?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className="markdown-image">
      {loaded ? (
        <>
          <img
            src={src}
            alt={alt}
            title={title}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <button type="button" onClick={() => setLoaded(false)}>
            Hide image
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setLoaded(true)}>
          Load image{alt ? `: ${alt}` : ""}
        </button>
      )}
    </span>
  );
}

type MarkdownNode = {
  type: string;
  tagName?: string;
  children?: readonly MarkdownNode[];
};

function containsImage(node: MarkdownNode): boolean {
  return node.tagName === "img" || Boolean(node.children?.some(containsImage));
}

function MarkdownLink({href,children,title,node}:ComponentProps<'a'> & ExtraProps) {
    const references=useIssueReferences();
    const reference=references.find(row=>href===`/app/issues/${row.identifier}`);
    const safe = safeUrl(href);
    if (!safe) return <span>{children}</span>;
    const external = safe.startsWith("https://");
    const linkProps = {
      href: safe,
      title,
      target: external ? "_blank" : undefined,
      rel: "noopener noreferrer",
      referrerPolicy: "no-referrer" as const,
    };
    // Markdown permits a linked image. Keep its explicit load button outside
    // the anchor so activating that button cannot also follow the link.
    return node && containsImage(node) ? (
      <span>
        {children} <a {...linkProps}>Open linked page</a>
      </span>
    ) : (
      reference ? <Tooltip label={`${reference.title} · ${reference.status.name}`}><a {...linkProps} title={undefined}>{children}</a></Tooltip> : <a {...linkProps}>{children}</a>
    );
}

const components: Components = {
  a: MarkdownLink,
  img({ src, alt, title }) {
    const safe = safeUrl(typeof src === "string" ? src : undefined, true);
    if (!safe) return <span>{alt || "Image unavailable"}</span>;
    // A changed URL remounts the control: permission to fetch one image cannot
    // silently become permission to fetch a replacement after a comment edit.
    return (
      <RequestedImage key={safe} src={safe} alt={alt || ""} title={title} />
    );
  },
};

/** CommonMark text with no raw HTML and no automatic remote image requests. */
export function SafeMarkdown({
  children,
  activeOperatorIds,
  onTaskChange,
  taskBusy = false,
  descriptionAnchors = false,
}: {
  children: string;
  activeOperatorIds?: readonly string[];
  onTaskChange?: (task: { index: number; text: string; checked: boolean }) => void | Promise<void>;
  taskBusy?: boolean;
  descriptionAnchors?: boolean;
}) {
  const references = useIssueReferences();
  const operators = useMentionOperators();
  const operatorIds =
    activeOperatorIds ??
    operators?.data?.operators.map((operator) => operator.id) ??
    [];
  const tasks = parseTasks(children);
  const rendered: Components = { ...components,
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    code: ({ className, children }) => <HighlightedCode className={className}>{children}</HighlightedCode>,
    input: TaskCheckbox,
  };
  return (
    <MarkdownTasks.Provider value={{ tasks, busy: taskBusy, onChange: onTaskChange }}><div className="safe-markdown">
      <Markdown
        remarkPlugins={[remarkGfm, remarkDetails, [remarkIssueReferences, { references }], [remarkMentions, { operatorIds }], [remarkDescriptionAnchors, { enabled: descriptionAnchors }]]}
        rehypePlugins={[rehypeTaskIndices]}
        skipHtml
        components={rendered}
        urlTransform={(url, key) => safeUrl(url, key === "src")}
      >
        {children}
      </Markdown>
    </div></MarkdownTasks.Provider>
  );
}
