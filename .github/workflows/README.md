# CI/CD Workflows

## Architecture

```
build-frontend.yml    push / PR → build + upload artifact
deploy-frontend.yml   triggered after build completes:
  └── deploy          event == push         → deploy to production
  └── deploy-preview  event == pull_request → deploy preview (manual approval)
deploy-backend.yml    PR → dry-run build check
                      push to main → deploy
```

## Why this structure

Fork PRs cannot access secrets in `pull_request` workflows (GitHub security restriction).

The solution is to split build and deploy into separate workflows:

1. `build-frontend.yml` runs in the `pull_request` context without needing secrets, then uploads the artifact
2. `deploy-frontend.yml` listens via `workflow_run` and runs in the base repo context, where secrets are accessible

## First-time setup: create the preview Environment

PR preview deployments require manual approval via GitHub Environment protection rules.

**Repo → Settings → Environments → New environment**

1. Name it `preview`
2. Enable **Required reviewers** and add yourself
3. Save

> If the environment is not created on GitHub, the `deploy-preview` job will run without pausing for approval.
