import type { ComponentType } from 'react';
import { useLocation } from '@tanstack/react-router';
import { useEditorLeafReady } from '../../../vendor/base/editor/react';

/** Called by each actual rendered destination, after its lazy code is ready. */
export function editorLeaf<P extends object>(Component:ComponentType<P>) {
  return function EditorLeaf(props:P) {
    const routeKey=useLocation({select:location=>location.href});
    useEditorLeafReady(routeKey);
    return <Component {...props}/>;
  };
}
