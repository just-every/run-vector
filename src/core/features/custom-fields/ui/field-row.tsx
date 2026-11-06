import { useState } from 'react';
import type { Administration } from '../../administration/schema';
import { useAdministrationCall } from '../../settings/ui/admin/administration';
import { RowMenu } from '../../settings/ui/fields/row-menu';
import type { CustomField } from '../schema';
import { RenameInPlace } from './rename-in-place';

/** One field: its name, type and description, then its options. A rename keeps
 * the option's identity, so issues that have it keep it. */
export function FieldRow({ team, field, editable }: { team: Administration['teams'][number]; field: CustomField; editable: boolean }) {
  const call = useAdministrationCall();
  const [renaming, setRenaming] = useState<string | null>(null);
  const patch = (change: object) => call(`/api/settings/teams/${team.id}/custom-fields/${field.id}`, 'PATCH', { expectedVersion: field.version, ...change });
  const renameOption = (id: string, name: string) => patch({ options: field.options.map(option => ({ id: option.id, name: option.id === id ? name : option.name })) });
  return <section className="custom-field" aria-label={`${field.name} field`}>
    <div className="status-line">
      {renaming === field.id
        ? <RenameInPlace label={`Field name ${field.name}`} value={field.name} save={name => patch({ name })} onDone={() => setRenaming(null)} />
        : <h2 className="group-heading custom-field-name">{field.name}</h2>}
      <span className="row-meta">Single-select</span>
      {editable && renaming !== field.id && <RowMenu name={`${field.name} field`} items={[{ label: 'Rename field', onSelect: () => setRenaming(field.id) }]} />}
    </div>
    {field.description && <p className="field-hint">{field.description}</p>}
    <ul className="status-rows" aria-label={`${field.name} options`}>
      {field.options.map(option => <li key={option.id} className="status-row">
        <div className="status-line">
          {renaming === option.id
            ? <RenameInPlace label={`Option name ${option.name}`} value={option.name} save={name => renameOption(option.id, name)} onDone={() => setRenaming(null)} />
            : <span className="status-name">{option.name}</span>}
          {editable && renaming !== option.id && <RowMenu name={option.name} items={[{ label: 'Rename', onSelect: () => setRenaming(option.id) }]} />}
        </div>
      </li>)}
    </ul>
  </section>;
}
