#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a124f45b2e761c8f32ad945396bb9e10bf9c783559e3baebe0beacb43bf8c21b/contract';
import startContract from '../../snapshots/a124f45b2e761c8f32ad945396bb9e10bf9c783559e3baebe0beacb43bf8c21b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e9a321e0128d5fa8b40bbf364f27c36558c7366f06af3ed74e7b663665eea857/contract';
import endContract from '../../snapshots/e9a321e0128d5fa8b40bbf364f27c36558c7366f06af3ed74e7b663665eea857/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'email_delivery_attempt',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('errorCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('providerMessageId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('recipientMasked', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'email_delivery_attempt',
        index: 'email_delivery_attempt_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'email_delivery_attempt',
        index: 'email_delivery_attempt_status_createdAt_idx_58610442',
        columns: ['status', 'createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
