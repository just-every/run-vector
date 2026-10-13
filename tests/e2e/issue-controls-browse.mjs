import { exercisePagedBrowse } from "./issue-paging-browse.mjs";
import assert from "node:assert/strict";
import { auditBothWidths, settled } from "./ui-state-audit.mjs";

export async function exerciseBrowse(context, fixture) {
  const { page, base } = context;
  const { api, a, b, done, team, backlog, opts, pageSize } = fixture;
  await page.goto(base + "/app/issues");
  await page.getByRole("heading", { name: "Issues", exact: true }).waitFor();
  await page.getByLabel("Title or identifier").fill("Browse proof");
  await settled(page);
  assert.equal((await api("/api/issues?q=Browse%20proof")).issues.some(row => row.identifier === done.identifier), false, "VIEW-001 completed hidden by default");
  await auditBothWidths(context, "issues-default-completed-hidden");
  for (const [label, value] of [["Team", team.id], ["Status", backlog.id], ["Priority", "high"], ["Due date", "overdue"], ["Blocked state", "unblocked"], ["Sort", "priority"], ["Group by", "priority"]])
    await page.getByLabel(label, { exact: true }).selectOption(value);
  await settled(page);
  await page.locator(`#issue-row-${a.identifier}`).waitFor();
  assert.equal(await page.locator(`#issue-row-${b.identifier}`).count(), 0, "VIEW-001 combined filters exclude nonmatching rows");
  const query = new URL(page.url()).search;
  const filtered = await api("/api/issues" + query);
  assert.deepEqual(filtered.issues.map(row => row.identifier), [a.identifier], "VIEW-001 combined controls reach server query");
  assert.ok(filtered.groups.some(group => group.key === filtered.issues[0].groupKey), "VIEW-001 SQL group metadata matches rows");
  await auditBothWidths(context, "issues-combined-filter-sort-group");
  await page.getByLabel("Blocked state", { exact: true }).selectOption("blocked");
  await settled(page);
  await page.getByRole("heading",{name:"No matching issues",exact:true}).waitFor();
  await auditBothWidths(context,"issues-combined-empty");
  await page.getByLabel("Blocked state", { exact: true }).selectOption("unblocked");
  await page.getByLabel("Due date", { exact: true }).selectOption("range");
  await page.getByLabel("Due from", { exact: true }).fill("2019-01-01");
  await page.getByLabel("Due to", { exact: true }).fill("2021-01-01");
  await auditBothWidths(context, "issues-date-range");
  await page.getByRole("button", { name: "Reset controls", exact: true }).click();
  await settled(page);
  for (const [label,value] of [["Priority","all"],["Sort","newest"],["Group by","none"],["Status category","all"]]) assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),value,`VIEW-003 reset ${label}`);
  await page.getByLabel("Title or identifier").fill("Browse proof");
  await settled(page);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await settled(page);
  assert.equal(new URL(page.url()).searchParams.get("offset"), String(pageSize), "VIEW-001 page advances");
  await auditBothWidths(context, "issues-second-page");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByLabel("Status category", { exact: true }).selectOption("completed");
  await settled(page);
  await page.locator(`#issue-row-${done.identifier}`).waitFor();
  await auditBothWidths(context, "issues-completed");
  await page.getByRole("button", { name: "Reset controls", exact: true }).click();
  await page.waitForURL(url=>new URL(url).search==="");
  // Every select value is exercised against real response data; empty states remain audited.
  for (const sort of ["newest","oldest","priority","status","due","updated"]) {
    await page.getByLabel("Sort",{exact:true}).selectOption(sort);
    await page.waitForURL(url=>(new URL(url).searchParams.get("sort")??"newest")===sort);
    await settled(page);
    const sorted=await api("/api/issues"+new URL(page.url()).search);
    assert.equal(new URL(page.url()).searchParams.get("sort")??"newest",sort,`VIEW-001 ${sort} reaches query`);
    assert.deepEqual(await page.locator(".issues-row .issues-identifier").allTextContents(),sorted.issues.map(row=>row.identifier),`VIEW-001 ${sort} browser rows preserve server order`);
    await auditBothWidths(context, `issues-sort-${sort}`);
  }
  for (const grouping of ["none","status","assignee","priority","project","cycle","team"]) {
    await page.getByLabel("Group by",{exact:true}).selectOption(grouping);
    await page.waitForURL(url=>(new URL(url).searchParams.get("grouping")??"none")===grouping);
    await settled(page);
    const grouped=await api("/api/issues"+new URL(page.url()).search);
    const expected=grouping==="none"?grouped.issues:grouped.groups.flatMap(group=>grouped.issues.filter(row=>row.groupKey===group.key));
    assert.equal(new URL(page.url()).searchParams.get("grouping")??"none",grouping,`VIEW-001 ${grouping} reaches query`);
    assert.deepEqual(await page.locator(".issues-row .issues-identifier").allTextContents(),expected.map(row=>row.identifier),`VIEW-001 ${grouping} browser groups preserve server membership and order`);
    if(grouping!=="none")assert.equal(await page.locator(".issues-group h2").count(),grouped.groups.length,`VIEW-001 ${grouping} shows every SQL group`);
    await auditBothWidths(context, `issues-group-${grouping}`);
  }
  for (const [label,value] of [["Assignee","unassigned"],["Project",opts.projects[0].id],["Cycle","none"],["Label",opts.labels[0].id],["Parent","none"]]) {
    await page.getByRole("button",{name:"Reset controls",exact:true}).click();
    await page.getByLabel(label,{exact:true}).selectOption(value);
    await settled(page);
    await auditBothWidths(context, `issues-filter-${label}`);
  }
  await page.getByRole("button",{name:"Reset controls",exact:true}).click();
  await exercisePagedBrowse(context, fixture);

}
