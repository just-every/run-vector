# Try Vector on one Linear team

One page for a team that is happy with Linear and wants to see what moving
costs before deciding. Nothing here touches Linear: you export, Vector reads the
files, and you can undo the whole move.

1. **Export the team's issues.** In Linear, export the workspace issue CSV
   ([Exporting data](https://linear.app/docs/exporting-data)). Keep only the team
   you are trying, or import the whole file and map its teams.
2. **Make the API file (optional, recommended).** The CSV has no comments,
   attachment links or relations beyond the parent. Run the script in
   [LINEAR-API-FILE.md](LINEAR-API-FILE.md) with your own Linear API key, on your
   own machine, for that team.
3. **Prepare Vector.** Create the team, labels, projects and open cycles you want
   the issues to land in, and invite the people who will work there. A person who
   is not invited is fine: their issues land unassigned and the report lists them.
4. **Preview.** Settings → Data / Move in → "Linear CSV with API file" (or
   "Linear workspace CSV"), a source name such as `linear-eng`, both files. Map
   any status that differs per team (`Engineering/In Review` → Started). Fix every
   error the preview lists; nothing is written until you apply.
5. **Read what will be left behind.** The review groups every value Vector will
   not import (kept in the original file) with its rows. Tick that you read it.
6. **Apply.** Watch "applied N of M batches". You can close the page; Read /
   resume continues where it stopped, and nothing is imported twice.
7. **Read the reconciliation report.** Rows read against issues written, by team,
   status, project, cycle and assignee; what was omitted; what was never in the
   files (attachment bytes, history, memberships). Download the CSV: it maps every
   Linear ID to its Vector identifier. Search for an old Linear ID to check it
   finds the work.
8. **Use it for a week.** Work in Vector as you would in Linear. Each imported
   issue says where it came from.
9. **Decide.** Keep it, or roll back: Retained import runs → Roll back shows what
   goes and refuses while anyone has edited, commented on or linked an imported
   issue (it names them). Rollback removes every issue the run created and nothing
   else; identifier numbers stay reserved and the original files stay.

What this does not prove: Vector has been tested with generated files of 2,000
and 4,000 issues on the local runtime, not with your export and not on a hosted
installation at that size.
