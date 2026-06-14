# Zavorth - Internal Beta Artifact Manifest

Este manifesto documenta as especificações e o estado de distribuição do artefato de Release Candidate gerado para o dry run do beta interno.

## Metadata do Candidato
* **Candidate Name**: `zavorth-internal-beta-rc-2026-06-14`
* **HEAD**: `fd39058047757fc0f4de79dc2392c439cca67113`
* **Base Tag**: `zavorth-internal-beta-rc-2026-06-14`
* **Commit List (desde o checkpoint pós-21K-B)**:
  * `fd39058047757fc0f4de79dc2392c439cca67113`: `docs(beta): add internal beta RC validation package`
* **CreatedAt**: 2026-06-14T20:46:00-03:00
* **Platform**: Windows 11 (x64)

## Especificações do Build
* **Build Commands**:
  ```bash
  npm run surfaces:check
  npm run runtime:check
  npm --prefix apps/zavorth-desktop run build
  ```

## Especificações do Artefato
* **Artifact Name**: `zavorth-internal-beta-rc-2026-06-14.zip`
* **Artifact Type**: Zip Archive (compilado de frontend desktop compilado estaticamente)
* **Artifact Relative Path**: `tmp/internal-beta/zavorth-internal-beta-rc-2026-06-14.zip`
* **Artifact Size**: 106091 bytes
* **SHA256 Checksum**: `FF47E2F195B38567AB74D246FB558BBFA4671304F7D14D7A53F5AB4C075B4C34`

## Estado de Distribuição e Limitações
* **Distribution Status**: `LOCAL_DRY_RUN_ONLY`
* **Known Issues**: Listados no documento `docs/beta/internal-beta-known-issues.md`.
