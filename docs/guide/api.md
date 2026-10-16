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

## Use a local development token

Choose `issues:read` for the list request below. A token created while signed in through `RER_OPEN` also requires this checkout's private development key on every request. A bearer token alone returns 401. Keep `rer dev` running, then run this in Bash from the checkout, replacing the origin with the address printed as `RER_READY`:

```sh
VECTOR_ORIGIN='http://127.0.0.1:8787'
read -r -s -p 'API token: ' VECTOR_TOKEN
. ./.rer/local/dev-key.env
curl --fail-with-body \
  --header "Authorization: Bearer $VECTOR_TOKEN" \
  --header "x-rer-dev-key: $RER_DEV_KEY" \
  "$VECTOR_ORIGIN/api/v1/issues"
unset VECTOR_TOKEN RER_DEV_KEY
```

Paste the token when prompted; it is not shown or written into shell history. The key is loaded from its owner-only file without printing it. Keep both credentials private and omit verbose curl logging. Reset changes the checkout key and invalidates its old development credentials. Development tokens do not work on a deployed installation and are excluded from archives. For a deployed installation, create a token there and send only its bearer header.

## Watch and revoke

**Token usage** in the same place lists each request a token made, when, and whether it was allowed. Choose **Revoke** next to a token to stop it at once.

After you restore Vector from an archive, its tokens do not come back. Make new ones.
