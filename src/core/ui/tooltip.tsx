import { cloneElement, createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './tooltip.css';

type Trigger = { 'aria-describedby'?: string; title?: string };
const Scope = createContext(false);
export function TooltipScope({ children }: { children: ReactNode }) {
  return <Scope.Provider value={true}>{children}</Scope.Provider>;
}
export function ScopedTooltip({ label, children }: { label: string; children: ReactElement<Trigger> }) {
  return useContext(Scope) ? <Tooltip label={label}>{children}</Tooltip> : cloneElement(children, {title: children.props.title ?? label});
}
export function Tooltip({ label, children }: { label: string; children: ReactElement<Trigger> }) {
  const id = useId(), anchor = useRef<HTMLSpanElement>(null), popup = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false), [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const hide = () => { clear(); setOpen(false); setPosition(null); };
  const leave = (related: EventTarget | null) => {
    if (related instanceof Node && (anchor.current?.contains(related) || popup.current?.contains(related))) return;
    if (anchor.current?.contains(document.activeElement)) { clear(); return; }
    hide();
  };
  useEffect(() => () => clear(), []);
  useLayoutEffect(() => {
    if (!open || !anchor.current || !popup.current) return;
    const target = anchor.current.getBoundingClientRect(), box = popup.current.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(target.left + target.width / 2 - box.width / 2, innerWidth - box.width - 8)),
      top: target.bottom + box.height + 8 < innerHeight ? target.bottom + 6 : Math.max(8, target.top - box.height - 6) });
  }, [open, label]);
  return <span className="tooltip-anchor" ref={anchor}
    onPointerEnter={() => { clear(); timer.current = setTimeout(() => setOpen(true), 300); }}
    onPointerLeave={event => leave(event.relatedTarget)}
    onFocusCapture={() => { clear(); setOpen(true); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) hide(); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); hide(); } }}>
    {cloneElement(children, { 'aria-describedby': open ? [children.props['aria-describedby'], id].filter(Boolean).join(' ') : children.props['aria-describedby'] })}
    {open && createPortal(<span ref={popup} id={id} role="tooltip" className="vector-tooltip"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}
      onPointerLeave={event => leave(event.relatedTarget)}>{label}</span>, document.body)}
  </span>;
}
