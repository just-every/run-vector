import { Children, cloneElement, createContext, isValidElement, useContext, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import './settings-save-feedback.css';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed';
export type SaveField = { name: string; id: string; choice?: string };
export type SaveFailure = { message: string; retryable: boolean };
type Feedback = { state: SaveState; field: SaveField | null; failure: SaveFailure | null; retry: () => void; ready: boolean };
export const SettingsSaveFeedback = createContext<Feedback | null>(null);

export function saveField(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): SaveField {
  return {name: field.name, id: field.id, ...(field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type) ? {choice: field.value} : {})};
}
function control(children: ReactNode): { name?: string; choice?: string } | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ name?: string; type?: string; value?: string | number; children?: ReactNode }>(child)) continue;
    if (['input', 'select', 'textarea'].includes(String(child.type))) return {name: child.props.name, ...(['checkbox', 'radio'].includes(child.props.type ?? '') ? {choice: String(child.props.value ?? 'on')} : {})};
    const nested = control(child.props.children);
    if (nested) return nested;
  }
}

/** Place the status out of flow in room the field already has, so nothing moves:
 * at the end of the label's first line when that is free, else under the field
 * (under the whole group when several choices share one field name). */
function placeStatus(status: HTMLElement) {
  const wrapper = status.parentElement, label = wrapper?.querySelector<HTMLLabelElement>(':scope > label');
  if (!wrapper || !label) return;
  const field = label.control ?? label.querySelector('input, select, textarea');
  const taken = Array.from(label.querySelectorAll('input, select, textarea, button'), node => node.getBoundingClientRect());
  const text: DOMRect[] = [];
  const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent?.trim() || walker.currentNode.parentElement?.closest('input, select, textarea, button')) continue;
    const range = document.createRange();
    range.selectNodeContents(walker.currentNode);
    text.push(...Array.from(range.getClientRects()).filter(rect => rect.width && rect.height));
  }
  const box = wrapper.getBoundingClientRect(), size = status.getBoundingClientRect(), style = getComputedStyle(label), own = label.getBoundingClientRect();
  // An inline label ends with its text; the room beside it runs to the field's end.
  const end = style.display.startsWith('inline') ? box.right : own.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
  const line = text.reduce<DOMRect | undefined>((first, rect) => !first || rect.top < first.top ? rect : first, undefined);
  const gap = parseFloat(getComputedStyle(status).fontSize) / 2;
  const top = line ? line.top + (line.height - size.height) / 2 : 0;
  const fits = line && end - size.width >= box.left && ![...text, ...taken].some(rect =>
    rect.top < top + size.height && rect.bottom > top && rect.right + gap > end - size.width && rect.left < end);
  const name = field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement ? field.name : '';
  const group = name ? field?.closest('fieldset') : null;
  const under = group && group.querySelectorAll(`[name="${CSS.escape(name)}"]`).length > 1 ? group.getBoundingClientRect() : null;
  const control = field?.getBoundingClientRect();
  const bottom = under?.bottom ?? Math.max(own.bottom, control?.bottom ?? own.bottom);
  const right = under?.right ?? Math.max(style.display.startsWith('inline') ? 0 : own.right, control?.right ?? own.right);
  status.style.top = `${(fits ? top : bottom) - box.top}px`;
  status.style.right = `${box.right - (fits ? end : right)}px`;
}

/** Keep feedback beside the edited label without making it part of that label. */
export function SettingsFieldLabel({ children, fieldName, ...props }: ComponentProps<'label'> & { fieldName?: string }) {
  const feedback = useContext(SettingsSaveFeedback);
  const field = control(children);
  const active = feedback?.field && ((feedback.field.name === (fieldName ?? field?.name) && feedback.field.choice === field?.choice) || (props.htmlFor && feedback.field.id === props.htmlFor));
  const message = active && (feedback.state === 'saved' || feedback.state === 'saving') ? feedback.state === 'saved' ? 'Saved' : 'Saving…' : null;
  const statusNode = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = statusNode.current;
    if (!node?.parentElement) return;
    const place = () => placeStatus(node);
    place();
    const observer = new ResizeObserver(place);
    observer.observe(node.parentElement);
    if (node.parentElement.parentElement) observer.observe(node.parentElement.parentElement);
    return () => observer.disconnect();
  }, [message]);
  let placed = false;
  const status = message ? <span ref={statusNode} className="settings-field-status" aria-hidden="true">{message}</span> : null;
  const content = Children.map(children, child => {
    if (!placed && typeof child === 'string' && child.trim()) {
      placed = true;
      return <span className="settings-field-label">{child}</span>;
    }
    return child;
  });
  return <div className="settings-save-field">
    <label {...props}>{content}</label>{status}
    {active && feedback.state === 'failed' && feedback.failure && <p className="settings-field-error" role="alert">{feedback.failure.message}{feedback.failure.retryable && <> <button type="button" onClick={feedback.retry}>Retry</button></>}</p>}
  </div>;
}

/** Existing native field markup shares the same feedback; custom controls use SettingsFieldLabel. */
export function withSettingsLabels(children: ReactNode, ready: boolean): ReactNode {
  return Children.map(children, child => {
    if (!isValidElement<{ children?: ReactNode; disabled?: boolean }>(child) || typeof child.type !== 'string') return child;
    if (['input', 'select', 'textarea', 'button'].includes(child.type)) return cloneElement(child, {disabled: !ready || child.props.disabled});
    if (child.type === 'label') return <SettingsFieldLabel {...child.props}>{withSettingsLabels(child.props.children, ready)}</SettingsFieldLabel>;
    return cloneElement(child, {}, withSettingsLabels(child.props.children, ready));
  });
}
