# Integrations

Connect Vector to the tools around it: let a monitoring or support tool send reports into **Needs decision**, tell another service when issues change, and link GitHub pull requests to issues. All of it lives in **Settings**, under **Integrations**. Making a token for scripts is covered in [API and tokens](api.md).

Every secret Vector gives you here is shown once. Copy it into the tool that needs it, then choose **I saved it; close**.

## Send reports into Needs decision

A signed source is a tool you trust to report problems, such as error tracking or a support desk. Its reports arrive in **Needs decision** with their evidence, for someone to accept, defer or decline ([Decide what comes in](triage.md)).

1. Under **Signed signal sources**, give the source a name and a short ID that never changes, such as `sentry`.
2. Choose the team its reports go to.
3. Choose **Register source**, then give the tool the secret, the receiver address and the two IDs Vector shows you.

The tool signs every report with that secret, and Vector turns away anything unsigned or signed with the wrong one. A report never reopens an issue someone has already decided. The format a tool sends is in the [integration reference](../INTEGRATIONS.md).

To change a source's secret, set how many hours the old one should keep working (up to 24) and choose **Rotate**. **Revoke** stops the source at once.

## Tell another service when issues change

Vector can send a signed message to an address of yours when an issue is created, changed or completed. The message carries the issue's identifier, title and status, never its description or files.

1. Under **Outbound webhooks**, give the destination a name and its HTTPS address.
2. Choose **Register destination** and give the receiving service the secret Vector shows you.

Settings says whether sending is set up for your installation. Until it is, messages wait and are sent once it is. **Delivery history** shows each message and how it went. When Vector cannot tell whether a message arrived, it does not send it again; check with the receiving service and record what happened with **Reconcile this delivery**.

## Link GitHub pull requests

1. Under **GitHub pull request webhooks**, give the repository a name and enter its owner and name, for example `octocat/linguist`.
2. Choose **Register repository**. Vector shows a receiver address and a secret.
3. In the repository on GitHub, open **Settings**, then **Webhooks**, and add a webhook. Use the receiver address as the payload URL, choose `application/json`, paste the secret, and pick only the **Pull requests** event.

A pull request whose title or description names an issue, such as `FLW-12`, appears on that issue with its title and whether it is open, closed or merged. A pull request never creates, closes or reprioritises an issue, and Vector never signs in to your GitHub account.

## After a restore

An archive keeps your sources, destinations and repositories but not their secrets, and nothing is sent or received until you finish the steps in [Installation archives](archives.md#before-your-team-starts-again). Then each connection shows **Re-enter secret**: choose it and give the new secret to the tool. A connection waiting for its secret holds its own messages; the others carry on.
