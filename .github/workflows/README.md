# CI/CD Workflows

## Architecture

```
ci.yml   pull_request → checks · e2e · dependency-review
                      → auto-merge (Dependabot) | jules-fix (on failure)
         push to main → checks · e2e → deploy (one Cloudflare Worker: SPA assets + API)
```

One workflow handles both CI and CD. `checks` (format, lint, typecheck, i18n,
test, build) and `e2e` run on every pull request and every push to `main`. The
`deploy` job runs only on push to `main`, gated by `needs: [checks, e2e]` so it
ships only after both pass. There is a single deploy target (one Worker, one
origin), so build + deploy live in one job with no `workflow_run` artifact hand-off.

## Dependabot auto-merge → deploy

`ci.yml` merges a green Dependabot PR using `secrets.AUTOMERGE_TOKEN` (a dedicated
token, **not** the default `GITHUB_TOKEN`) so the resulting push to `main` re-triggers
`ci.yml` and deploys. A push made with `GITHUB_TOKEN` would not.

> `AUTOMERGE_TOKEN` and `JULES_API_KEY` must live in **Dependabot** secrets, not
> Actions secrets — Dependabot-triggered runs only see the Dependabot secret store.
