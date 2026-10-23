# Release Line

- Shows a GitHub repository's branches as a vertical metro map (`src/app/core/graph.ts`: topo sort + lane layout + SVG paths) from the oldest release tag to the newest commit, with tags and branch heads as labels. Dragging a release tag onto a commit, or clicking a commit, opens the release dialog that dispatches the tag's workflow.
- Name "Release Line" is not translated. Signature colour grape `#9c36b5`. UI texts EN/CS in `src/app/i18n.ts`, themes auto/light/dark.
- GitHub is called straight from the browser (REST + GraphQL, token in localStorage). `server/` is only a Fastify proxy for the two OAuth device-flow endpoints (no CORS at github.com). OAuth App client ID `Ov23liQxQft0mOoICDaJ` is public and committed in `server/app.ts`, scope `repo`. Personal access token sign-in works without the server.
- Release tags = non-version tags (filter field supports globs). With an empty filter only tags with a matching workflow count, so stale tags don't stretch the range. Tag → workflow: `.github/release-line.yml` > user pick (localStorage) > workflow file/name contains the tag > workflow content pushes the tag (`src/app/core/workflows.ts`).
- Dispatch ref: input named ref/sha/commit, else a branch or tag at the commit, else a temporary `release-line/<sha>` branch deleted when the run finishes (`src/app/store.ts` polls pending runs).
- Tests: `npm test` (node --test, core logic + proxy).
