#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0de287499e5db7dce522a0af929d26415d9950d56b8d62d532a6c24307404f32/contract';
import startContract from '../../snapshots/0de287499e5db7dce522a0af929d26415d9950d56b8d62d532a6c24307404f32/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/53fdb3b9673009fdc39b6645e93b223d057cca2b6545d55e81ca150887e0bc10/contract';
import endContract from '../../snapshots/53fdb3b9673009fdc39b6645e93b223d057cca2b6545d55e81ca150887e0bc10/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('attacks', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('blockedShots', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('dangerousAttacks', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('freeKicks', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('goalKicks', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('saves', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('shotsInsideBox', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('shotsOffTarget', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('shotsOutsideBox', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('substitutions', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_statistic',
        column: col('throwIns', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'player_match_statistic',
        column: col('blocks', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'player_match_statistic',
        column: col('cleanSheet', 'bool', { codecRef: { codecId: 'pg/bool@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'player_match_statistic',
        column: col('dribblesAttempted', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'player_match_statistic',
        column: col('fouls', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'player_match_statistic',
        column: col('goalsConceded', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'player_match_statistic',
        column: col('saves', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'player_match_statistic',
        column: col('successfulDribbles', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
