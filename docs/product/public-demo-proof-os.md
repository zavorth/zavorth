# Public demo — Proof OS (static)

Short map of the **approve → receipt** marketing surfaces. None of these are a live agent session.

## Surfaces

| Surface | Path | Notes |
| --- | --- | --- |
| Monorepo static visual demo | [`assets/zavorth-demo/index.html`](../../assets/zavorth-demo/index.html) | Offline HTML; interactive trust loop; banner *Static product demo — not a live agent session* |
| Public website demo | Website route `/demo` | Fixture story + interactive `TrustLoopDemo` client component |
| Product demo smoke | `npm run zavorth:demo:check` | Ensures demo assets, CLI path and connector doctor stay wired |

## Honesty rules

- Always label **static / fixture / offline**.
- Never claim **live runtime**, **live agent**, or silent autonomy.
- Receipt ids and timestamps in the static loop are **fixture** evidence for UX only.
- Catalog readiness ≠ live; see [honesty-readiness.md](./honesty-readiness.md).

## Loop shown

1. **Request** — operator goal text  
2. **Plan / change preview** — static bullets (read, patch, validate, rollback)  
3. **Approve** — explicit human signal  
4. **Receipt** — id, time, status  

Open the monorepo file in a browser (no server required) or visit the website `/demo` page after `npm run website:public` in `zavorth-website`.
