#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6556dd3eff7b2c4e96bb1d824c445291f6e47fafcc42cff0509497cb3e450878/contract';
import startContract from '../../snapshots/6556dd3eff7b2c4e96bb1d824c445291f6e47fafcc42cff0509497cb3e450878/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a124f45b2e761c8f32ad945396bb9e10bf9c783559e3baebe0beacb43bf8c21b/contract';
import endContract from '../../snapshots/a124f45b2e761c8f32ad945396bb9e10bf9c783559e3baebe0beacb43bf8c21b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'password_reset_token',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('usedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'password_reset_token',
        constraint: 'password_reset_token_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'password_reset_token',
        index: 'password_reset_token_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'password_reset_token',
        index: 'password_reset_token_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'password_reset_token',
        foreignKey: {
          name: 'password_reset_token_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
