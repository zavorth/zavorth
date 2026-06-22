# PROACTIVITY.md - Proactive Behavior Policies

When and how the agent should act proactively.

## Rules

### Important email or calendar event

- **Trigger:** new important email or upcoming calendar event
- **Channel:** dashboard
- **Severity:** high
- **Action:** notify
- **Time window:** working hours

### Code review completed

- **Trigger:** PR review completed or CI status change
- **Channel:** dashboard
- **Severity:** medium
- **Action:** notify
- **Time window:** working hours

### Scheduled task completed

- **Trigger:** background task finishes
- **Channel:** dashboard
- **Severity:** low
- **Action:** notify
- **Time window:** any

### Learning user preference

- **Trigger:** agent detects a durable preference
- **Channel:** internal
- **Severity:** low
- **Action:** update files silently
- **Time window:** any

## Quiet Hours

- **Start:** 22:00
- **End:** 07:00

## Default Channel

- **Channel:** dashboard

## File boundary

What belongs here:
- proactive behavior rules
- notification channels
- quiet hours
- severity thresholds

What does not belong here:
- tool policies (TOOL-POLICY.md)
- time schedules (TIME-AUTOMATION.md)

## Maintenance rule

When proactivity preferences change, update this file.
When notification channels change, update accordingly.
