# False Positive Guidelines

Use these rules to reduce overclaiming.

## Secrets and environment files

- `.env` file existence alone is not confirmed exposure.
- `NEXT_PUBLIC_*` is expected to ship to the client; flag only when the value is sensitive.
- Example placeholders are not production secrets.

## Auth and authorization

- route naming (`admin`, `private`, `internal`) is only a hint.
- client route guards do not prove backend authorization.
- middleware presence does not prove object-level access control.

## Injection

- string interpolation is suspicious only when it reaches a dangerous sink.
- ORM usage is not automatically safe; identify unsafe raw-query APIs when possible.
- escaped or parameterized calls should reduce severity or confidence.

## Dependencies

- outdated package versions are not equivalent to a confirmed exploit path.
- do not cite CVEs unless they were actually retrieved from evidence the user provided or from a live source.

## Reporting language

Prefer language like:

- "confirmed by code"
- "likely risk"
- "appears unprotected based on visible code"
- "manual verification recommended"
