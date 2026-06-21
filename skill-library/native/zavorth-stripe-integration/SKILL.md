---
name: Stripe Payment Architect
description: Scaffold payment intents, subscriptions, webhooks, and upgrade Stripe SDK integrations.
license: Zavorth-Internal
---

# Stripe Payment Architect

Use this native skill when:
- The task requires operations in the 'development' domain.
- Performing actions matching: scaffold payment intents, subscriptions, webhooks, and upgrade stripe sdk integrations.

## Operating Rules

- Avoid hardcoding live Stripe keys; reference env variables securely.
- Construct secure webhook verification schemas to prevent signature spoofing.
- Verify currency handling complies with ISO 4217 specifications.

## Output

Return React/Node Stripe integrations code, webhook routing code, and setup logs.
