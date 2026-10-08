#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3b7f071e51ccdd54466d3581e59ebbf3a8c5aea5e21bbb29823dbb97a32a08ab/contract';
import startContract from '../../snapshots/3b7f071e51ccdd54466d3581e59ebbf3a8c5aea5e21bbb29823dbb97a32a08ab/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/91aab35b1de35c807eb7e8eab4b47bdc55fb63e01953d7507ecd7ded9e6189c2/contract';
import endContract from '../../snapshots/91aab35b1de35c807eb7e8eab4b47bdc55fb63e01953d7507ecd7ded9e6189c2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'favourite_match',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('matchId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('seasonId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('slot', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'favourite_match',
        constraint: 'favourite_match_matchId_key',
        columns: ['matchId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'favourite_match',
        constraint: 'favourite_match_seasonId_slot_key',
        columns: ['seasonId', 'slot'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favourite_match',
        index: 'favourite_match_seasonId_idx_aa50cbae',
        columns: ['seasonId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favourite_match',
        foreignKey: {
          name: 'favourite_match_seasonId_fkey',
          columns: ['seasonId'],
          references: { schema: 'public', table: 'season', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favourite_match',
        foreignKey: {
          name: 'favourite_match_matchId_fkey',
          columns: ['matchId'],
          references: { schema: 'public', table: 'football_match', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
