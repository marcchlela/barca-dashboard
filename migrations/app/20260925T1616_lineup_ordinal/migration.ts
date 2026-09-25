#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/53fdb3b9673009fdc39b6645e93b223d057cca2b6545d55e81ca150887e0bc10/contract';
import startContract from '../../snapshots/53fdb3b9673009fdc39b6645e93b223d057cca2b6545d55e81ca150887e0bc10/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ab80e523f0f42c7647e39a2c23ef6b102102f5b0f68a5f04b61bbce06c2326a4/contract';
import endContract from '../../snapshots/ab80e523f0f42c7647e39a2c23ef6b102102f5b0f68a5f04b61bbce06c2326a4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'lineup_player',
        column: col('lineupOrdinal', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
