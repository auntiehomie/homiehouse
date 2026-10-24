import { createDecipheriv, scryptSync } from 'node:crypto';
import { getDb } from '@/lib/db';
import { encryptSignerKey } from '@/lib/signer-crypto';

function decryptWithMaterial(value: string, material: string): string | null {
  try {
    const combined = Buffer.from(value.slice(4), 'base64');
    if (combined.length < 29) return null;
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(combined.length - 16);
    const ciphertext = combined.subarray(12, combined.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', scryptSync(material, 'homiehouse-salt', 32), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('hex');
  } catch {
    return null;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const newEncryptionKey = process.env.SIGNER_ENCRYPTION_KEY;
  if (apply && (!newEncryptionKey || Buffer.byteLength(newEncryptionKey) < 32)) {
    throw new Error('Set SIGNER_ENCRYPTION_KEY to at least 32 bytes before applying the migration.');
  }

  const candidates = [
    process.env.SIGNER_ENCRYPTION_KEY,
    process.env.LEGACY_SIGNER_ENCRYPTION_KEY,
    process.env.DATABASE_URL?.slice(0, 32),
    'hh-fallback-key-change-me',
  ].filter((value): value is string => Boolean(value));
  const db = getDb();
  const client = await db.connect();
  try {
    if (apply) await client.query('BEGIN');
    const { rows } = await client.query<{ id: string; signer_uuid: string }>(
      `SELECT id, signer_uuid FROM scheduled_casts WHERE signer_uuid IS NOT NULL AND signer_uuid <> 'app-managed' ORDER BY id${apply ? ' FOR UPDATE' : ''}`,
    );
    const migrated = rows.map(({ id, signer_uuid }) => {
      let privateKey: string | null;
      if (signer_uuid.startsWith('enc:')) {
        privateKey = candidates.map((candidate) => decryptWithMaterial(signer_uuid, candidate)).find(Boolean) ?? null;
      } else {
        privateKey = /^[0-9a-fA-F]{64}$/.test(signer_uuid) ? signer_uuid.toLowerCase() : null;
      }
      if (!privateKey) throw new Error(`Could not safely migrate signer key for scheduled cast row ${id}; no database changes were made.`);
      return { id, oldValue: signer_uuid, newValue: apply ? encryptSignerKey(privateKey) : null };
    });

    if (!apply) {
      console.log(`Dry run: ${migrated.length} scheduled signer key(s) can be migrated. No database changes were made. Re-run with --apply to encrypt them.`);
      return;
    }

    for (const row of migrated) {
      const result = await client.query(
        'UPDATE scheduled_casts SET signer_uuid = $1 WHERE id = $2 AND signer_uuid = $3',
        [row.newValue, row.id, row.oldValue],
      );
      if (result.rowCount !== 1) throw new Error(`Scheduled cast row ${row.id} changed during migration; rolling back.`);
    }
    await client.query('COMMIT');
    console.log(`Encrypted ${migrated.length} scheduled signer key(s).`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Signer key migration failed.');
  process.exitCode = 1;
});
