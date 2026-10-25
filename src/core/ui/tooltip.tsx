import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import './tooltip.css';

type Trigger = { 'aria-describedby'?: string; title?: string };
let activeTooltip: { id: string; close: () => void } | null = null;

export function Tooltip({ label, children }: { label: string; children: ReactElement<Trigger> }) {
  const id = useId(), anchor = useRef<HTMLSpanElement>(null), popup = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), touch = useRef(false);
  const [open, setOpen] = useState(false), [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const clear = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  const hide = useCallback(() => {
    clear(); setOpen(false); setPosition(null);
    if (activeTooltip?.id === id) activeTooltip = null;
  }, [clear, id]);
  const show = () => {
    if (activeTooltip?.id !== id) activeTooltip?.close();
    activeTooltip = { id, close: hide };
    setOpen(true);
  };
  const leave = (related: EventTarget | null) => {
    if (related instanceof Node && (anchor.current?.contains(related) || popup.current?.contains(related))) return;
    if (anchor.current?.contains(document.activeElement)) { clear(); return; }
    hide();
  };
  useEffect(() => () => { clear(); if (activeTooltip?.id === id) activeTooltip = null; }, [clear, id]);
  useLayoutEffect(() => {
    if (!open || !anchor.current || !popup.current) return;
    const place = () => {
      if (!anchor.current || !popup.current) return;
      const target = anchor.current.getBoundingClientRect(), box = popup.current.getBoundingClientRect();
      setPosition({ left: Math.max(8, Math.min(target.left + target.width / 2 - box.width / 2, innerWidth - box.width - 8)),
        top: target.bottom + box.height + 8 < innerHeight ? target.bottom + 6 : Math.max(8, target.top - box.height - 6) });
    };
    place();
    window.addEventListener('resize', place);window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place);window.removeEventListener('scroll', place, true); };
  }, [open, label]);
  return <span className="tooltip-anchor" ref={anchor}
    onPointerEnter={event => { if (event.pointerType === 'touch') return; clear(); timer.current = setTimeout(show, 300); }}
    onPointerLeave={event => leave(event.relatedTarget)}
    onPointerDown={event => { touch.current = event.pointerType === 'touch'; hide(); }}
    onClick={hide}
    onFocusCapture={() => { clear(); if (!touch.current) show(); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) hide(); }}
    onKeyDown={event => { touch.current = false; if (event.key === 'Escape' && open) { event.stopPropagation(); hide(); } }}>
    {cloneElement(children, { title: undefined, 'aria-describedby': open ? [children.props['aria-describedby'], id].filter(Boolean).join(' ') : children.props['aria-describedby'] })}
    {open && createPortal(<span ref={popup} id={id} role="tooltip" className="vector-tooltip"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}
      onPointerLeave={event => leave(event.relatedTarget)}>{label}</span>, document.body)}
  </span>;
}
