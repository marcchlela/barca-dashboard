#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/945c48602bffa02866c6b8d90d20e109d62b11f762eeb4c5d72db82177c029a0/contract';
import endContract from '../../snapshots/945c48602bffa02866c6b8d90d20e109d62b11f762eeb4c5d72db82177c029a0/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f64562ada54d6648dbe850b4390eeeecf0279a74d9d50886a664aad1cae62da1/contract';
import startContract from '../../snapshots/f64562ada54d6648dbe850b4390eeeecf0279a74d9d50886a664aad1cae62da1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'standing_snapshot',
        column: col('basis', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'standing_snapshot',
        column: col('dataSourceId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'standing_snapshot',
        index: 'standing_snapshot_dataSourceId_idx_536a4d74',
        columns: ['dataSourceId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'standing_snapshot',
        foreignKey: {
          name: 'standing_snapshot_dataSourceId_fkey',
          columns: ['dataSourceId'],
          references: { schema: 'public', table: 'data_source', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
