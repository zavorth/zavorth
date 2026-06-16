# Remote Memory Sync Threat Model - Phase 21S-A

> [!IMPORTANT]
> This is a design-only document for Phase 21S-A. No runtime implementation is performed in this phase.

## 1. Sensitivity Analysis of Memory Files
The files synchronized by Zavorth contain highly confidential operator data:
- `USER.md`: Personal preferences, timezone, role, language, and background.
- `IDENTITY.md`: Persona and agent identity notes.
- `MEMORY.md`: Long-term episodic context, strategically compiled facts, and custom notes.

Due to this high sensitivity, **local-only storage is the strict default**, and cloud synchronization requires explicit, authenticated opt-in configuration.

---

## 2. Threat Scenarios and Mitigations

### Threat 1: Unauthorized Cloud Bucket Access (Eavesdropping)
*   **Description**: An attacker gains access to the S3/R2 storage bucket or intercepts the network transfer.
*   **Impact**: Leakage of private user preferences, session history, and sensitive workspace context.
*   **Mitigation**: **Encryption-Before-Upload**. The client encrypts memory files locally using AES-GCM (with keys derived from `ZAVORTH_DB_ENCRYPTION_KEY`) before uploading them to the bucket. The bucket policy must enforce SSL-only transfers, block public access, and encrypt data at rest with customer-managed keys.

### Threat 2: Secret Leaks in Memory Files (Unredacted Data Sync)
*   **Description**: The model includes secrets (API keys, git tokens) in `MEMORY.md`, which are then synced to the cloud bucket.
*   **Impact**: Leaked credentials.
*   **Mitigation**: Pre-upload redaction. The sync script runs `redactSecrets(...)` and scans for sensitive patterns before encrypting and uploading the file.

### Threat 3: Multi-Instance Race Conditions (Conflict Resolution)
*   **Description**: Two instances of Zavorth (e.g. CLI and Telegram daemon) run concurrently and write changes to `MEMORY.md` at the same time, resulting in out-of-sync database records.
*   **Impact**: Loss of memory updates or file corruption.
*   **Mitigation**: Last-Write-Wins with version hashing. Every upload includes a checksum and version metadata. If the remote version does not match the local version upon read, a conflict resolution prompt is raised, or updates are merged sequentially.

### Threat 4: Revocation / Data Delete Failure
*   **Description**: The user revokes cloud-sync permissions but old data remains stored on the bucket.
*   **Impact**: Persistent data footprints.
*   **Mitigation**: Explicit deletion routine. When cloud-sync is revoked, Zavorth executes a purge command (`s3:DeleteObject`) on the bucket path to remove all encrypted versions before deleting the local keys.

---

## 3. Auditing and Verification
- All upload and download synchronization events must write a receipt to `SecurityAuditLogger` containing the file name, target hash, and sync status.
- Connection credentials and secret bucket keys must be redacted from all system logs.
