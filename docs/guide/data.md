# Your data

Everything Vector knows lives in your own installation: issues, history, comments and files. You can take a complete copy at any time and restore it into a new, empty installation.

## Export and restore

Stop Vector first, then export:

```sh
node scripts/rer.mjs export --output exports/vector.jsonl
```

Export writes a new private file and never overwrites an existing one. To restore it, use an empty installation:

```sh
node scripts/rer.mjs import --input exports/vector.jsonl --yes
```

## What a copy holds

An archive keeps your issues, their history, comments, views, settings and every attached file. It never holds sign-in sessions, sign-in links or secrets, so after a restore everyone signs in again, and the owner reviews the other people and any outgoing connections before they work again.

Keep archives somewhere private: they are a full copy of your workspace. [Installation archives](archives.md) says what a copy holds, how to restore it step by step, and how to let your team back in afterwards.
