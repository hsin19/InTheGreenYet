# CI/CD Workflows

## Architecture

```
pr.yml          pull_request → frontend / backend / e2e / dependency-review
                              → auto-merge (Dependabot) | jules-fix (on failure)
frontend.yml    push to main (frontend paths) → build + test + deploy to Cloudflare Pages
backend.yml     push to main (backend paths)  → build + test + deploy to Cloudflare Workers
e2e.yml         push to main → end-to-end smoke
```

Validation runs on PRs via `pr.yml`. The per-stack `frontend.yml` / `backend.yml`
re-run the build/tests on `main` and deploy in the same job, gated by
`github.event_name == 'push' && github.ref_name == github.event.repository.default_branch`. Build and deploy
live in one workflow each (no `workflow_run` artifact hand-off) — there is a single
deploy target and no fork-PR secret constraint to work around.

## Dependabot auto-merge → deploy

`pr.yml` merges a green Dependabot PR using `secrets.AUTOMERGE_TOKEN` (a dedicated
token, **not** the default `GITHUB_TOKEN`) so the resulting push to `main` triggers
`frontend.yml` / `backend.yml`. A push made with `GITHUB_TOKEN` would not.

> `AUTOMERGE_TOKEN` and `JULES_API_KEY` must live in **Dependabot** secrets, not
> Actions secrets — Dependabot-triggered runs only see the Dependabot secret store.
