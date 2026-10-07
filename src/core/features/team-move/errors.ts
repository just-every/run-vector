export class TeamMoveError extends Error {
  constructor(
    readonly code: "unauthenticated" | "issue_not_found" | "invalid_option",
    message: string,
    readonly status: 401 | 404 | 400,
  ) {
    super(message);
  }
}
