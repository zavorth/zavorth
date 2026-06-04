# Zavorth Capability Mesh

Capability Mesh is the native arbitration layer that decides how Zavorth should handle a request with existing skills, skill composition, or governed skill drafting.

It reads only Zavorth-owned inventories:

```text
native skill catalog
skill composition options
skill creation/adaptation drafts
```

It does not install a skill, call a network endpoint, mutate files, or expose tools during arbitration.

## Daily Use

Ask naturally:

```text
zavorth capability-mesh --request "revise esse codigo Rust com seguranca"
```

The mesh returns ranked native options:

```text
native-skill
skill-composition
create-zavorth-skill
adapt-native-capability
```

## Decision Rules

```text
1. Prefer an exact Zavorth-native skill.
2. If the request is multi-step, consider composing native skills.
3. If no capability exists, propose creating a skill draft.
4. If a draft should become reusable, keep it preview-first until approval.
```

## Safety

```text
read-only inventory
no network probe
no skill installed
no secret serialized
skill creation starts as draft
```

## Example

User:

```text
Zavorth, use a melhor capacidade para revisar Rust.
```

Mesh result:

```text
native generic code review: partial
create rust review skill: fallback/draft
```

Zavorth can then ask:

```text
Tenho uma skill generica e posso criar um draft de skill Rust mais especifico.
Quer revisar o draft antes de instalar?
```
