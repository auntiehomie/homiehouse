# Security review notes

## Scheduled signer-key encryption rollout

`SIGNER_ENCRYPTION_KEY` is required to encrypt signer keys for newly scheduled casts. Generate a stable secret with `openssl rand -base64 48` and configure it in each server environment. Keep it in the deployment secret store and do not rotate it without planning a key re-encryption.

Before deploying the fail-closed signer-key change to an existing database, run the migration from an environment with database access and the new key configured:

```sh
npx tsx scripts/migrate-scheduled-signer-keys.ts
npx tsx scripts/migrate-scheduled-signer-keys.ts --apply
```

The first command is a dry run. The migration rewrites both legacy plaintext keys and previously encrypted keys (including values created with the old weak fallback) using `SIGNER_ENCRYPTION_KEY`. It decrypts known prior formats in memory, does not print key material, and uses a transaction for the apply step. If any key cannot be decrypted, it aborts without updating rows. Make a protected database backup before applying it. Legacy plaintext values are unusable by the publisher after the fail-closed code ships, so complete the migration before deployment.

## Recurring review

The monthly Homiehouse dependency and security review checks dependency advisories, ownership and auth boundaries, server-side URL fetching, secrets, headers, uploads, and CI. Findings should be recorded with severity, affected route or package, and a tracked remediation.
