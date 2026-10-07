import { createFileRoute } from '@tanstack/react-router'
import { NewIssueForm } from '../core/features/issues/ui/new-issue-form'
export const Route = createFileRoute('/app/new-issue')({
  component: NewIssueForm,
})
