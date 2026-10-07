export class DependencyError extends Error {
  constructor(
    readonly code:
      | "unauthenticated"
      | "issue_not_found"
      | "self_dependency"
      | "dependency_exists"
      | "dependency_cycle"
      | "dependency_not_found",
    message: string,
    readonly status: 401 | 404 | 409,
  ) {
    super(message);
  }
}
