import {createFileRoute} from '@tanstack/react-router'
import {editorLeaf} from '../core/editor/leaf'
import {SignInSection} from '../core/features/settings/ui/sections/sign-in-section'
export const Route=createFileRoute('/app/settings/sign-in')({component:editorLeaf(SignInSection)})
