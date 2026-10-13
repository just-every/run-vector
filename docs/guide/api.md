# API and tokens

Scripts and other tools can read and change issues through Vector's API with a token. A token can do only what you allow it to, and only for as long as the person who made it can.

## Make a token

1. Open **Settings** and go to **Integrations**, then **API tokens**.
2. Give the token a name that says what will use it.
3. Tick only the permissions it needs, and choose an expiry time if you want one.
4. Choose **Create token**, copy the token, then choose **I saved it; close**. Vector shows it only once.

| Permission | What it allows |
| --- | --- |
| `issues:read` | List issues and read one issue |
| `issues:write` | Create issues and change them |
| `comments:write` | Add comments |
| `metadata:read` | Read the teams, statuses, people, projects, cycles and labels |

A token acts as the person who made it. When that person is removed from Vector, their tokens stop working.

## Use a token

Send the token in an `Authorization: Bearer` header to your Vector address. Never put it in a link.

| Request | Permission | What it does |
| --- | --- | --- |
| `GET /api/v1/issues` | `issues:read` | Lists issues, with the same filters, sorting and paging as the Issues screen |
| `GET /api/v1/issues/FLW-12` | `issues:read` | Reads one issue |
| `POST /api/v1/issues` | `issues:write` | Creates an issue |
| `PATCH /api/v1/issues/FLW-12` | `issues:write` | Changes an issue |
| `POST /api/v1/issues/FLW-12/comments` | `comments:write` | Adds a comment |
| `GET /api/v1/metadata` | `metadata:read` | Lists teams, statuses, people, projects, cycles and labels |

When you change an issue, send the `expectedVersion` you last read. If someone changed the issue in the meantime, Vector refuses the change with status 409; read it again and retry. The API cannot delete anything.

Other answers you may see: 401 when the token is missing, wrong, expired, revoked or lacks the permission; 400 when the request is not valid; 404 when the issue does not exist.

## Watch and revoke

**Token usage** in the same place lists each request a token made, when, and whether it was allowed. Choose **Revoke** next to a token to stop it at once.

After you restore Vector from an archive, its tokens do not come back. Make new ones.
