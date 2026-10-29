import {createFileRoute,stripSearchParams} from '@tanstack/react-router';
import {editorLeaf} from '../core/editor/leaf';
import {ReleasePage} from '../core/features/releases/ui/releases';
export const Route=createFileRoute('/app/releases/$releaseId')({validateSearch:(search:Record<string,unknown>)=>({readOnly:search.readOnly===1||search.readOnly===true||search.readOnly==='1'||search.readOnly==='true'}),search:{middlewares:[stripSearchParams({readOnly:false})]},component:editorLeaf(Page)});
function Page(){return <ReleasePage id={Route.useParams().releaseId} readOnly={Route.useSearch().readOnly}/>;}
