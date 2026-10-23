# Release Line

See the branches and release tags of a GitHub repository as a metro map and release by moving a tag. Built for repositories like [bosancz/interni-sekce](https://github.com/bosancz/interni-sekce) with `NEXT` and `PRODUCTION` tags moved by release workflows. No ads, no tracking.

Part of [Smallhill Apps](../../README.md), served at https://apps.smallhill.cz/release-line/.

## How it works

- Sign in with GitHub (device flow: the app shows a code, you approve it on github.com) or paste a fine-grained personal access token with Contents and Actions read and write. The token stays in the browser.
- The timeline runs from the oldest release tag to the newest commit across the branches active in that range.
- Long runs of commits between tags are hidden behind a "N commits hidden" row and only loaded when you open them.
- Drag a release tag to another commit, or click a commit and pick a tag. The dialog runs the tag's release workflow with its `workflow_dispatch` inputs; until the run ends the tag shows as pending.

## Matching tags to workflows

1. `.github/release-line.yml` in the repository:

    ```yaml
    tags:
        PRODUCTION:
            workflow: release-production.yml
            color: "#2b8a3e"
            inputs:
                semver: patch
        NEXT: release-next.yml
    ```

2. Your pick on the Tag workflows page, saved on the device.
3. A manually runnable workflow whose file name or title contains the tag (`release-next.yml` → `NEXT`).
4. A manually runnable workflow that pushes the tag (`tag: NEXT`).

GitHub runs workflows on a branch or tag, so the app passes the commit in an input named `ref`, `sha` or `commit` when there is one, otherwise uses a branch or tag already at the commit, otherwise creates a temporary `release-line/<sha>` branch and deletes it after the run.

## Run locally

```sh
npm install
npm run dev:server   # device-flow proxy on :3000
npm run dev          # app on :4200, proxies /api to :3000
```
