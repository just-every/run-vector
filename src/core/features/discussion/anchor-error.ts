export class DescriptionAnchorError extends Error {
  readonly code: string;
  constructor(readonly status: 400 | 409, message: string) {
    super(message);
    this.code = status === 409 ? 'stale_description' : 'invalid_anchor';
  }
}
