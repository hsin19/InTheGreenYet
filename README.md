# InTheGreenYet

It’s not about today’s profit — it’s about knowing where you truly stand.

## Architecture

```
/frontend   → React + Tailwind (Vite) → CF Pages
/proxy      → CF Worker (auth + Notion API proxy)
```

**Database:** Notion (via OAuth)

## Deployment

GitHub Actions → Cloudflare Pages + Workers
