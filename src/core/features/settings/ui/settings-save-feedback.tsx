import { Children, cloneElement, createContext, isValidElement, useContext, type ComponentProps, type ReactNode } from 'react';
import './settings-save-feedback.css';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed';
export type SaveField = { name: string; id: string; choice?: string };
type Feedback = { state: SaveState; field: SaveField | null; retry: () => void };
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

/** Keep feedback beside the edited label without making it part of that label. */
export function SettingsFieldLabel({ children, fieldName, ...props }: ComponentProps<'label'> & { fieldName?: string }) {
  const feedback = useContext(SettingsSaveFeedback);
  const field = control(children);
  const active = feedback?.field && ((feedback.field.name === (fieldName ?? field?.name) && feedback.field.choice === field?.choice) || (props.htmlFor && feedback.field.id === props.htmlFor));
  let placed = false;
  const status = active && (feedback.state === 'saved' || feedback.state === 'saving')
    ? <span className="settings-field-status" aria-hidden="true">{feedback.state === 'saved' ? 'Saved' : 'Saving…'}</span> : null;
  const content = Children.map(children, child => {
    if (!placed && typeof child === 'string' && child.trim()) {
      placed = true;
      return <span className="settings-field-label">{child}</span>;
    }
    return child;
  });
  return <div className="settings-save-field">
    <label {...props}>{content}</label>{status}
    {active && feedback.state === 'failed' && <p className="settings-field-error" role="alert">Couldn’t save. <button type="button" onClick={feedback.retry}>Retry</button></p>}
  </div>;
}

/** Existing native field markup shares the same feedback; custom controls use SettingsFieldLabel. */
export function withSettingsLabels(children: ReactNode): ReactNode {
  return Children.map(children, child => {
    if (!isValidElement<{ children?: ReactNode }>(child) || typeof child.type !== 'string') return child;
    if (child.type === 'label') return <SettingsFieldLabel {...child.props}>{child.props.children}</SettingsFieldLabel>;
    return cloneElement(child, {}, withSettingsLabels(child.props.children));
  });
}
