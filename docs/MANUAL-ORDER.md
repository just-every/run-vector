# Manual planning order

Choose **Manual order** in the issue list or board. A selected team's sequence is shared by the list and board. Each saved view has its own shared sequence, independent of its layout and of other views. A shared view's readers can reorder its issues; its owner still owns its name, filters and sharing configuration.

Use the row's **Reorder** handle to drop it before another row in the same group, the Up, Down and Top buttons, or Alt-Up, Alt-Down and Alt-Home on a focused list row. The move buttons work within the displayed group and page; Top moves to the start of the sequence. Grouping still orders groups before their rows. Unpositioned issues follow positioned work by identifier. Choose a team before reordering a built-in list; workspace-wide saved views can order across teams. A stale change is refused and the current order is loaded.

Positions are separate from issue properties, activity and update times. Reordering never changes Current's derived ranking, issue status or version. Team and view order survives archives; deleted issues and views lose their associated positions.

## Bringing an order with you

The supported Jira CSV profile reads one **Rank** or **Custom field (Rank)** column, in ascending binary string order. Duplicate rank columns or invalid values are refused in preflight. The Linear CSV plus API-file profile reads the issue's optional finite numeric **sortOrder** in ascending order; the API-file producer requests it. These fields are [Jira's sortable rank](https://docs.atlassian.com/jira-software/6.4.0.8/com/atlassian/greenhopper/model/lexorank/LexoRank.html) and [Linear's manual list order](https://github.com/linear/linear/blob/master/packages/sdk/src/schema.graphql).

New ranked rows append as a block after existing positioned work in their mapped team. Ties use the new identifier. Missing ranks remain unpositioned. The reviewed plan fixes the resulting positions independently of dependency-first publication. Repeat uses the original snapshot; it never retrofits rank into an earlier import. A later native reorder blocks repeat and rollback from overwriting it. An untouched ranked run rolls back its positions with its issues. Older imports without ranking keep their existing custody hashes.

This is documented-format, synthetic-file acceptance, using the existing reviewed import path. Live provider import and real owner exports remain the separate DATA-013/DATA-014 work.
