import { useState } from 'react';
import { useDiscussion } from '../../issues/ui/discussion-client';

export function DescriptionImageInsert({ identifier, onInsert }: { identifier: string; onInsert: (text: string) => void }) {
  const { resource } = useDiscussion(identifier, () => {}), [id, setId] = useState(''), [alt, setAlt] = useState('');
  const files = resource.error ? [] : (resource.data?.files ?? []).filter(file =>
    file.state === 'ready' && !file.removalPending && file.contentType === 'image/png' && file.imageWidth && file.imageHeight);
  if (!files.length) return null;
  return <div className="description-image-insert" role="group" aria-label="Insert attached image">
    <label>Image attachment<select aria-label="Image attachment" value={id} onChange={event => setId(event.target.value)}>
      <option value="">Choose a PNG attachment</option>
      {files.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}
    </select></label>
    <label>Image alt text<input aria-label="Image alt text" value={alt} maxLength={500} onChange={event => setAlt(event.target.value)} /></label>
    <button type="button" disabled={!files.some(file => file.id === id)} onClick={() => {
      const escaped = alt.replace(/[\\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ');
      onInsert(`![${escaped}](attachment:${id})`);
      setId(''); setAlt('');
    }}>Insert image</button>
  </div>;
}
