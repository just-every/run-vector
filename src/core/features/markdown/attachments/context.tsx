import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDiscussion } from '../../issues/ui/discussion-client';
import { AttachmentViewer } from './viewer';
import './attachments.css';

export const attachmentId = (value: string) => /^attachment:([0-9A-HJKMNP-TV-Z]{26})$/.exec(value)?.[1];
export type ImageFile = { id: string; name: string; imageWidth: number; imageHeight: number };
type Images = { files: ImageFile[]; pending: boolean; url: (id: string) => string; open: (id: string, alt: string) => void };
const Context = createContext<Images | null>(null);

export function IssueAttachmentImages({ identifier, children }: { identifier: string; children: ReactNode }) {
  const { resource } = useDiscussion(identifier, () => {});
  const [selected, setSelected] = useState<{id: string; alt: string} | null>(null);
  const files: ImageFile[] = (resource.error ? [] : resource.data?.files ?? []).flatMap(file =>
    file.state === 'ready' && !file.removalPending && file.contentType === 'image/png' && file.imageWidth && file.imageHeight
      ? [{id: file.id, name: file.name, imageWidth: file.imageWidth, imageHeight: file.imageHeight}] : []);
  const url = (id: string) => `/api/issues/${identifier}/files/${id}`;
  return <Context.Provider value={{files, pending: resource.loading && !resource.data, url, open: (id, alt) => setSelected({id, alt})}}>
    {children}
    {selected && typeof document !== 'undefined' && createPortal(<AttachmentViewer files={files} selected={selected}
      url={url} onSelect={id => setSelected({id, alt: files.find(file => file.id === id)?.name ?? ''})} onClose={() => setSelected(null)} />, document.body)}
  </Context.Provider>;
}

export function AttachmentImage({ id, alt }: { id: string; alt: string }) {
  const images = useContext(Context), file = images?.files.find(file => file.id === id);
  const [failed, setFailed] = useState(false);
  if (images?.pending) return <span role="status">Loading image…</span>;
  if (!images || !file || failed) return <span className="attachment-removed">File removed</span>;
  return <span className="attachment-image">
    <button type="button" className="attachment-image-open" aria-label={`Open image: ${alt || file.name}`}
      onClick={() => images.open(file.id, alt)}>
      <img src={images.url(file.id)} width={file.imageWidth} height={file.imageHeight}
        alt={alt} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </button>
  </span>;
}
