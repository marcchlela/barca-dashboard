#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/21d76fd9260385074e2e65907b43639a7830b3829f194093c0afdaf5e9b47cdc/contract';
import startContract from '../../snapshots/21d76fd9260385074e2e65907b43639a7830b3829f194093c0afdaf5e9b47cdc/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d55970d92ed06dd2502e11dcc834c94bd95af920137c50083bac8be296881467/contract';
import endContract from '../../snapshots/d55970d92ed06dd2502e11dcc834c94bd95af920137c50083bac8be296881467/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'media_moment',
        column: col('curatedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
