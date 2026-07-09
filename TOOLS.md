# TOOLS.md - Local Notes

Skills define how tools work. This file is for local setup notes: the details
that are unique to a specific operator or host.

Do not store secrets here.

## Host environment

- **OS:** Windows 10/11 native (primary)
- **WSL2:** optional — use only if Docker sandbox or Linux shell isolation is needed
- **Workspace root:** this repository (`Zavorth`)
- **Approval posture:** personal dev profile — writes inside workspace are allowed; shell and network still require approval

## What Goes Here

- camera names and locations;
- SSH host aliases without passwords;
- preferred voices for TTS;
- speaker or room nicknames;
- device nicknames;
- other environment-specific hints that are safe to keep in the repository.

## Examples

```markdown
### Cameras

- living-room -> Main area, 180-degree wide angle
- front-door -> Entrance, motion-triggered

### SSH

- home-server -> 192.168.1.100, user: admin

### TTS

- Preferred voice: Nova
- Default speaker: Kitchen speaker
```

Skills are shared. Local setup notes are not. Keeping them separate makes it
possible to update skills without leaking private infrastructure.
