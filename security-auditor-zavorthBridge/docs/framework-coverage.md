# Framework Coverage Matrix

## Next.js Pages Router

Inspect:

- `pages/api/**`
- `pages/**` forms that mutate state
- auth middleware or wrappers
- custom server or API helpers
- database and service layers under `lib/`, `src/lib/`, `utils/`

Common risks:

- missing input validation on `req.body`, `req.query`, `req.cookies`
- auth present in UI but absent in API route
- raw SQL, raw prisma calls, unsafe shell execution
- weak CORS or no rate limiting
- JWTs in browser storage

## Next.js App Router

Inspect:

- `app/api/**/route.*`
- server actions and shared action helpers
- `middleware.*`
- route handlers for admin, billing, webhooks, exports, file upload
- dynamic segments and rewrite/proxy behavior

Common risks:

- authorization gaps in route handlers or server actions
- assuming middleware alone is sufficient for object-level authorization
- exposing secrets through `NEXT_PUBLIC_*`
- unsafe `fetch()` to user-controlled destinations on the server
- webhook endpoints without signature checks

## React-only projects

Inspect:

- `src/contexts`, `src/providers`, auth hooks
- route guards and protected route components
- `src/services`, `src/api`, `src/lib/api*`, axios/fetch wrappers
- components rendering markdown/html/user content
- upload components, editors, and preview flows
- environment variable references in client code

Common risks:

- secrets bundled into client code
- tokens stored in `localStorage`
- assuming hidden buttons or client guards equal real authorization
- unsanitized HTML/markdown rendering
- insecure direct API calls to privileged endpoints

## Shared code and monorepos

Inspect shared packages for:

- auth helpers
- db helpers
- ai clients and prompt builders
- logging utilities
- file and URL utilities

When shared code affects multiple apps, note the likely blast radius.
