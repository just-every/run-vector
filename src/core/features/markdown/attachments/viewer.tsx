import { useEffect, useRef, useState } from 'react';
import type { ImageFile } from './context';

export function AttachmentViewer({ files, selected, url, onSelect, onClose }: {
  files: ImageFile[]; selected: {id: string; alt: string}; url: (id: string) => string;
  onSelect: (id: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), [zoom, setZoom] = useState(1), [failed, setFailed] = useState(false);
  const index = files.findIndex(file => file.id === selected.id), file = files[index];
  useEffect(() => {
    const modal = dialog.current, trigger = document.activeElement;
    modal?.showModal();
    return () => { modal?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => { setZoom(1); setFailed(false); }, [selected.id]);
  function move(delta: number) {
    if (files.length > 1) onSelect(files[(index + delta + files.length) % files.length]!.id);
  }
  return <dialog className="attachment-viewer" ref={dialog} aria-label="Image viewer"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowRight' ? 1 : -1);
      }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    }}>
    <div className="attachment-viewer-toolbar">
      <strong>{file?.name ?? 'File removed'}</strong>
      <button type="button" autoFocus onClick={onClose}>Close viewer</button>
    </div>
    <div className="attachment-viewer-toolbar" role="group" aria-label="Image controls">
      <button type="button" disabled={files.length < 2} onClick={() => move(-1)}>Previous image</button>
      <span role="status">{index < 0 ? 'File removed' : `${index + 1} of ${files.length}`}</span>
      <button type="button" disabled={files.length < 2} onClick={() => move(1)}>Next image</button>
      <button type="button" disabled={zoom <= 0.25 || !file} onClick={() => setZoom(value => Math.max(0.25, value - 0.25))}>Zoom out</button>
      <output aria-label="Image zoom">{Math.round(zoom * 100)}%</output>
      <button type="button" disabled={zoom >= 4 || !file} onClick={() => setZoom(value => Math.min(4, value + 0.25))}>Zoom in</button>
      {file && <a href={url(file.id)} download={file.name}>Download image</a>}
    </div>
    <div className="attachment-viewer-canvas" tabIndex={0} aria-label="Full-size image">
      {file && !failed ? <img src={url(file.id)} alt={selected.alt} width={file.imageWidth} height={file.imageHeight}
        style={{width: file.imageWidth * zoom, height: file.imageHeight * zoom}}
        onError={() => setFailed(true)} /> : <p>File removed</p>}
    </div>
  </dialog>;
}
