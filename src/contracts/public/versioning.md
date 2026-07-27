# Zavorth Public Contracts Versioning

This document defines the versioning policy for Zavorth public contracts so external clients can rely on stable APIs.

## Principles

1. Strict backwards compatibility: breaking changes must not be introduced in minor or patch versions.
2. Explicit versioning: REST APIs, event schemas, and JSON schemas include a versioned path or payload field.
3. Canonical errors: error responses use one shared shape across public endpoints.
4. Pure DTOs: public data transfer objects do not leak internal runtime or database models.

## Schemas and Types

Surface interaction schemas are defined in TypeScript and exported from this module. SDKs should consume generated types from these contracts.

## Surface Domains

The public API is split into these canonical domains:

- `sessions`: sessions, conversation state, history, and replay.
- `gateway`: global runtime and ingress information.
- `platform`: plugins, skills, MCPs, and installation catalog.
- `nodes`: node mesh, companions, devices, and pairing.
- `transports`: remote transports, remote observability, and routes.
- `ops`: structural operations, health, diagnostics, and maintenance.
- `artifacts`: structured access to extracted or generated artifacts.

## Release Lifecycle

- Alpha/Beta: `/api/beta/*` or `/api/alpha/*`; compatibility is not guaranteed.
- Stable: `/api/v1/*`; compatibility is maintained for minor and patch releases.
- Deprecated: stable contracts receive a deprecation notice before removal.

## Compatibility Rules

- Additive fields are allowed when consumers can ignore unknown fields.
- Required field removals or type changes require a new major version.
- Error code changes require migration notes.
- Event payloads must preserve `version`, `type`, and `timestamp`.
