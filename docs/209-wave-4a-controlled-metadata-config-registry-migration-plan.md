# 209 - Wave 4A Controlled Metadata Config Registry Migration Plan

Status: wave4a-controlled-migration-plan-ready

Runtime boundary: ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan.ts

Contracts:
- ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan/v1
- ZavorthWave4AMigrationPlanItem/v1
- ZavorthWave4AControlledMigrationBatch/v1

Schema: zavorth-wave4a-metadata-config-registry-migration/v1

Guarantees:
- wave4aControlledMigrationPlanCreated=true
- migrationScopeMetadataConfigRegistryOnly=true
- rawSecretMigrationAllowed=false
- first batch executed: false

First controlled metadata/config/registry migration batch follow-up:
docs/210-wave-4a-first-controlled-metadata-config-registry-migration-batch.md

Do not advance beyond the first controlled Wave 4A batch until this plan is green.
