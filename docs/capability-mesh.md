# Zavorth Capability Mesh

Capability Mesh is the arbitration layer that decides how Zavorth should handle
a request when skills and connected external agents may both be available.

It reads inventories only:

```text
internal skill catalog
external agent gateway profiles
skill creation/adaptation options
```

It does not invoke an external agent, install a skill, call a network endpoint,
or expose tools during arbitration.

## Daily Use

Ask naturally:

```text
zavorth capability-mesh --request "revise esse código Rust com segurança"
```

If you explicitly want to consider connected agents more strongly:

```text
zavorth capability-mesh \
  --request "use o melhor agente externo para revisar Rust" \
  --prefer-external
```

The mesh returns ranked options:

```text
internal-skill
skill-composition
create-zavorth-skill
external-agent
adapt-external-capability
```

## Decision Rules

```text
1. Prefer exact Zavorth-native skill.
2. If the request is multi-step, consider composing internal skills.
3. If no capability exists, propose creating a skill draft.
4. If connected agents are stronger, propose delegated use with approval.
5. If an external capability should become native, propose adaptation/import.
```

## Safety

```text
read-only inventory
no external process started
no network probe
no skill installed
no secret serialized
external delegation requires approval per run
external adaptation/import requires review
skill creation starts as draft
```

## Example

User:

```text
Zavorth, use a melhor capacidade para revisar Rust.
```

Mesh result:

```text
internal generic code review: partial
external rust-reviewer: strong/exact, approval-required
create rust review skill: fallback/draft
```

Zavorth can then ask:

```text
Tenho uma skill interna genérica, mas o agente rust-reviewer é mais específico.
Quer que eu use esse agente externo em modo governado?
```

If approved, execution still goes through External Agent Gateway and receipts.
The suggested mesh command is preview-first; it does not include the live
approval flag. The operator must approve the generated gateway receipt before a
connected external agent is invoked.
