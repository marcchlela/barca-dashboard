#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0de287499e5db7dce522a0af929d26415d9950d56b8d62d532a6c24307404f32/contract';
import endContract from '../../snapshots/0de287499e5db7dce522a0af929d26415d9950d56b8d62d532a6c24307404f32/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/989e28ef6d0105e7d8e736984f907fd95d35f0cd771276322ec0ab6e51400117/contract';
import startContract from '../../snapshots/989e28ef6d0105e7d8e736984f907fd95d35f0cd771276322ec0ab6e51400117/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'provider_mapping',
        constraint: 'provider_mapping_dataSourceId_entityType_internalId_key',
      }),
      this.createIndex({
        schema: 'public',
        table: 'provider_mapping',
        index: 'pm_source_type_internal_61d4b70f',
        columns: ['dataSourceId', 'entityType', 'internalId'],
      }),
      this.renameIndex({
        schema: 'public',
        table: 'provider_mapping',
        from: 'provider_mapping_internalId_idx_1e636b89',
        to: 'pm_internal_1e636b89',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
