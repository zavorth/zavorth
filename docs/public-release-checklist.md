# Zavorth Public Release Checklist

This checklist defines the mandatory requirements and verification gates that must be satisfied before promoting any release candidate (RC) to a public production distribution.

---

## 1. Application Packaging & Code Signing
- [ ] **Code Signing Certificates**: Configure valid, trusted developer certificates for distribution bundles.
  - Windows: Authenticode signature setup (NSIS/MSI).
  - macOS: Developer ID signature and Hardened Runtime notarization (DMG/Zip).
- [ ] **Distribution Identification**: Update package metadata configurations to reference production release channels instead of `UNSIGNED_INTERNAL_RC`.

## 2. Clean Environment Installation & Smoke Testing
- [ ] **Fresh Installation Verification**: Test the installer packaging on fresh, clean virtual machine instances (Windows, macOS, Linux).
- [ ] **Zero-Untracked Integrity**: Confirm the application launches and operates correctly without depending on any local, uncommitted, or quarantined development files.

## 3. Operations & Rollback Safeguards
- [ ] **Documented Rollback Path**: Provide clear documentation on how to revert to the previous stable release version or RC, including:
  - Specifying correct tag/commit reference.
  - Verification commands (e.g., `git checkout <tag>`).
- [ ] **Database Schema Migrations**: Document and test database schema rollback capabilities in case of storage engine migration failures.

## 4. Privacy & Governance Policies
- [ ] **Privacy Policy Document**: Include a user-facing privacy policy detailing that:
  - All logs and SQLite data are kept 100% local.
  - Redaction of credential keys and HMAC-SHA256 hashing is enforced.
- [ ] **Egress Firewalls**: Document and verify the cognitive firewall rules preventing unauthorized LLM API requests or data leakage.

## 5. Security & Static Analysis Gates
- [ ] **Pre-release Secrets Sweep**: Run deep static analysis scanners (e.g., scan scripts or secret checkers) across the final built distribution assets to ensure no test credentials, tokens, or private mock keys are present.
- [ ] **Terminal Isolation Audit**: Verify that the static terminal isolation test (`DesktopTerminalDeferred.test.ts`) is fully enforced and no interactive shell emulation library (such as `node-pty`) has been bundled into the production workspace.

## 6. Manual Feature Verification
- [ ] **Write Approval Flow**: Manually verify the visual approval modal and transient memory garbage collection behavior:
  - Propose writes, verify side-by-side diff overlay.
  - Approve, verify file content is written and transient memory is flushed.
  - Reject, verify file is not written, no trace of code is left in logs or database, and memory is flushed.
- [ ] **ReadOnly Panel Compliance**: Verify visually that no mutation buttons are present or functional in settings, memory, skills, or channels panels.

## 7. Versioning & Release Control
- [ ] **Public Release Notes**: Compile a public user release notes document outlining new features, upgrades, security enhancements, and fixed bugs in user-friendly language.
- [ ] **Release Tagging & Push**: Perform git tagging and remote branch pushes only after explicit release authorization is granted by the release owner.
