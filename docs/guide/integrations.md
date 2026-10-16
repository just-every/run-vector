# Integrations

Connect Vector to the tools around it: let a monitoring or support tool send reports into **Needs decision**, tell another service when issues change, and link GitHub pull requests to issues. All of it lives in **Settings**, under **Integrations**. Making a token for scripts is covered in [API and tokens](api.md).

Every secret Vector gives you here is shown once. Copy it into the tool that needs it, then choose **I saved it; close**.

## Send reports into Needs decision

A source is a monitoring or support tool you trust to report problems. Reports arrive in **Needs decision** with their evidence, for someone to accept, defer or decline ([Decide what comes in](triage.md)).

1. Under **Signal sources**, give the source a name and a short ID that never changes, such as `support`.
2. Choose the team its reports go to, then **Register source**.
3. Copy the **Secret webhook URL**. In the setup panel, open **Connect Zapier, Make or UptimeRobot** and follow your tool’s steps. Anyone holding the URL can send reports; keep it private.
4. Send the in-page webhook test or a test from your tool, then open the returned issue identifier. A title is enough: Vector supplies the team and receipt time. Map a report ID to keep later updates on that issue.

**Replace webhook URL** immediately stops the previous URL. **Revoke** stops both the URL and signed sender. A report never reopens an issue someone has already decided.

Developers can choose **Signed sender** to use a signing secret and the supplied Node.js script. Rotation overlap keeps a previous signing secret working for up to 24 hours while the sender is updated. The [integration reference](../INTEGRATIONS.md) explains the protocol and accepted fields.

## Tell another service when issues change

Vector can send a signed message to an address of yours when an issue is created, changed or completed. The message carries the issue's identifier, title and status, never its description or files.

1. Under **Outbound webhooks**, use **Enable delivery**. The page explains how to create a read-only Cloudflare token to identify and exclude your hosting domains; Vector does not save the token. Then give the destination a name and its HTTPS address.
2. Open the page’s Zapier Catch Hook or Make custom webhook guide, create a receiver there, and paste its URL into **Public HTTPS destination**. Choose **Register destination**. These no-code receivers do not need the signing secret; custom developer receivers can use the verifier under **For developers**.
3. Choose **Send test**. Vector shows the receiver’s HTTP status and explains its reply. Check the receiving tool for `vector.test`, then enable its downstream action.

Settings says whether sending is set up for your installation. Until it is, messages wait and are sent once it is. **Delivery history** shows each event, its named destination, HTTP status and how it went. When Vector cannot tell whether a message arrived, it does not send it again; check with the receiving service and record what happened with **Reconcile this delivery**.

## Link GitHub pull requests

1. Under **GitHub pull request webhooks**, give the repository a name and enter its owner and name, for example `octocat/linguist`.
2. Choose **Register repository**. Vector shows a receiver address and a secret.
3. In the repository on GitHub, open **Settings**, then **Webhooks**, and add a webhook. Use the receiver address as the payload URL, choose `application/json`, paste the secret, and pick only the **Pull requests** event.

A pull request whose title or description names an issue, such as `FLW-12`, appears on that issue with its title and whether it is open, closed or merged. A pull request never creates, closes or reprioritises an issue, and Vector never signs in to your GitHub account.

## After a restore

An archive keeps your sources, destinations and repositories but not their secrets, and nothing is sent or received until you finish the steps in [Installation archives](archives.md#before-your-team-starts-again). Then create a fresh source webhook URL or re-enter each signing secret and give the new credential to the tool. A connection waiting for its secret holds its own messages; the others carry on.
