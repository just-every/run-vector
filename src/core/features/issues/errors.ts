export class IssueMutationError extends Error {
  constructor(
    readonly code: 'issue_not_found' | 'invalid_option' | 'invalid_transition',
    message: string,
  ) {
    super(message)
  }
}
