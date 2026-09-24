# CI/CD Workflows

## Architecture

```
check.yml   workflow_call → check: format · lint · typecheck · i18n · unit tests
                                   · build → Codecov upload
                          → e2e:   Playwright (parallel with check)
pr.yml      pull_request  → check.yml · dependency-review
                          → auto-merge (Dependabot)
deploy.yml  push to main  → check.yml → build → deploy (one Cloudflare Worker:
                                                SPA assets + API) → smoke check
```

`check.yml` is a reusable (`workflow_call`) workflow holding the single definition
of "did this tree pass" — everything `pnpm run check` covers locally, plus the
Playwright suite. Both other workflows call it, so a PR and a `main` push are held
to the same bar and the list cannot drift between them — which it did when one
`ci.yml` spelled the install-and-run steps out once per job.

`check` runs each check as its own step rather than chaining them into one
command, so the failing step names itself in the Actions UI, and the steps are
conditioned to keep going after one fails so a single run reports every failure
instead of stopping at the first. (They do stop depending on a successful
`pnpm install`, which would otherwise red all of them at once and bury the real
cause.) The unit tests need Chromium too — the SPA's `browser` test project runs
in it — so `check` installs it, not only `e2e`.

The Playwright suite is a second job inside `check.yml` rather than more steps on
`check`, so it runs in parallel with the rest and a failure still says `e2e`
instead of hiding inside a long step list. Its `webServer` builds the app and
serves it through `wrangler dev` itself, so there is no artifact to hand over.

Neither caller is called `ci.yml`, and that is the point: CI is not what tells them
apart — both run the same gate — so they are named for the event that starts them.
`pr.yml` therefore does not run on `main` pushes at all; `deploy.yml` handles that
commit, gate included. `check.yml` also takes a `workflow_dispatch`, so "run every
check against this ref" is available without going through either.

`deploy.yml` builds again in its own job: what ships carries `VITE_GIT_SHA`, which
the check build has no reason to set, and `wrangler deploy` reads the
`.wrangler/deploy` redirect config that build emits. The cost of this layout is
that every `main` push — a Dependabot auto-merge included — runs the full suite
again, e2e included; that double run per merged PR is the price of holding a
direct push to `main` to the same bar as a PR.

Two deploy-time guards are deliberate. `wrangler-action` pushes every secret it is
given, so an empty `NOTION_CLIENT_ID` or `NOTION_CLIENT_SECRET` would silently
replace the live value with `""` and break Notion login — the
`Verify required vars and secrets` step refuses the deploy instead. Afterwards the
`/health` endpoint is probed with retries. The deploy is on a custom domain, which
`wrangler-action` reports as `<host> (custom domain)` rather than a URL, so the
smoke check takes the host off the front before probing.

## Dependency review

`pr.yml`'s `dependency-review` job fails every PR with "Dependency review is not
supported on this repository" until the **Dependency graph** is on — enable
Dependabot alerts (Settings → Advanced Security), which switches it on too. It
also gates `auto-merge`, so with the graph off no Dependabot PR ever merges.

## Dependabot auto-merge → deploy

`pr.yml` merges a green Dependabot PR using `secrets.AUTOMERGE_TOKEN` (a dedicated
token, **not** the default `GITHUB_TOKEN`) so the resulting push to `main`
triggers `deploy.yml`. A push made with `GITHUB_TOKEN` would not — GitHub never
lets a `GITHUB_TOKEN` push start another workflow.

> `AUTOMERGE_TOKEN` must live in **Dependabot** secrets
> (Settings → Secrets and variables → Dependabot), not Actions secrets —
> Dependabot-triggered runs only see the Dependabot secret store.

`AUTOMERGE_TOKEN` is a fine-grained PAT scoped to this repository with
`contents: read/write` and `pull requests: read/write` permissions (or a classic
PAT with `repo` scope). A PAT shared with show-me-way or hop works only if its
repository access list includes this repo. Fine-grained PATs expire (max 1 year)
— an expired token makes auto-merge silently stop merging while CI stays green,
so track the expiry date. A red Dependabot PR (typically peer-dependency skew —
`@cloudflare/vitest-pool-workers` pins narrow ranges on `vitest` and
`@vitest/runner`, the `@lingui/*` packages must move together, and
`typescript-eslint` refuses to load outside its `typescript` peer range) is left
for a human; there is no auto-repair job. The groups in `dependabot.yml` exist to
keep those sets moving together in one PR.

The `deploy-actions` group in `dependabot.yml` is excluded from auto-merge.
`cloudflare/wrangler-action` only ever runs on a push to `main`, so a green PR
proves nothing about it and a bad bump would land straight in the production
deploy — it gets a human look instead.

## Coverage → Codecov

`test:ci` runs the SPA and the Worker suites separately and writes a coverage
directory and a JUnit report for each (`coverage/` + `test-report.junit.xml`,
`coverage-worker/` + `worker-test-report.junit.xml`). The two coverage uploads
carry the `frontend` and `backend` flags `codecov.yml` is organized around.

All uploads live in `check.yml`, so every caller gets them: a PR uploads its own
reports through `pr.yml`, and the `main` baseline those are diffed against is the
upload from `deploy.yml`'s call — the only run of the suite on the default branch.

> `CODECOV_TOKEN` is an **Actions** secret (Settings → Secrets and variables →
> Actions) — unlike `AUTOMERGE_TOKEN`. A Dependabot PR therefore cannot read it, so
> the upload no-ops there; `fail_ci_if_error: false` on every upload step is what
> keeps that from failing an otherwise green bump.

The upload steps carry `if: ${{ !cancelled() }}` so a failing `Build` step still
ships the reports the tests already produced — on `main` in particular, dropping
them would leave the next PR diffed against a stale baseline.
