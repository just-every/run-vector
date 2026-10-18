import type { Json } from "../../../../../vendor/base/import-kit/src/d1/index";
import { apiIssue } from "./api-file";
import { jiraColumns, jiraHeader } from "./jira";
import type { ImportDiagnostic, ImportInput } from "./types";
import type { MappedRow } from "./row-values";
const rankColumn = (header: string) =>
  ["rank", "custom field (rank)"].includes(jiraHeader(header));
/** Source ranking is independent of dependency-first publication and identifiers.
 * Reused rows never enter this function: their original reviewed snapshots stay exact. */
export async function mapManualOrder(
  db: D1Database,
  workspace: string,
  input: ImportInput,
  rows: MappedRow[],
  errors: ImportDiagnostic[],
) {
  const groups = new Map<string, { row: MappedRow; rank: string | number }[]>();
  for (const row of rows) {
    if (!row.value) continue;
    let rank: string | number | undefined;
    if (input.format === "jira-csv") {
      const columns = jiraColumns(row.record).filter((column) =>
        rankColumn(column.header),
      );
      if (columns.length > 1) {
        errors.push({
          row: row.record.location.row!,
          field: "Rank",
          code: "ambiguous_rank",
          message:
            "Keep one intended Jira Rank column; multiple rank columns cannot be combined.",
        });
        continue;
      }
      const value = columns[0]?.value.trim();
      if (value) {
        if (value.length > 255 || /[\u0000-\u0020\u007f]/.test(value)) {
          errors.push({
            row: row.record.location.row!,
            field: "Rank",
            code: "invalid_rank",
            message:
              "Jira Rank must be an ordered rank string with no whitespace, at most 255 characters.",
          });
          continue;
        }
        rank = value;
      }
    } else if (input.format === "linear-api-json")
      rank = apiIssue(row.record.payload as Record<string, Json>)?.sortOrder;
    if (rank === undefined) continue;
    const team = String(row.value.issue.team_id),
      group = groups.get(team) ?? [];
    group.push({ row, rank });
    groups.set(team, group);
  }
  for (const [team, group] of groups) {
    const scope = "team:" + team;
    const last =
      (await db
        .prepare(
          "SELECT max(position) position FROM manual_order_entries WHERE workspace_id=? AND scope_key=?",
        )
        .bind(workspace, scope)
        .first<number>("position")) ?? 0;
    group.sort((a, b) =>
      typeof a.rank === "number" && typeof b.rank === "number"
        ? a.rank - b.rank ||
          String(a.row.value!.issue.identifier).localeCompare(
            String(b.row.value!.issue.identifier),
          )
        : a.rank < b.rank
          ? -1
          : a.rank > b.rank
            ? 1
            : String(a.row.value!.issue.identifier).localeCompare(
                String(b.row.value!.issue.identifier),
              ),
    );
    group.forEach(({ row }, index) => {
      row.value!.manualOrder = [
        {
          workspace_id: workspace,
          scope_key: scope,
          issue_id: row.value!.issue.id,
          position: last + index + 1,
        },
      ];
    });
  }
}
