#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3b7f071e51ccdd54466d3581e59ebbf3a8c5aea5e21bbb29823dbb97a32a08ab/contract';
import endContract from '../../snapshots/3b7f071e51ccdd54466d3581e59ebbf3a8c5aea5e21bbb29823dbb97a32a08ab/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/945c48602bffa02866c6b8d90d20e109d62b11f762eeb4c5d72db82177c029a0/contract';
import startContract from '../../snapshots/945c48602bffa02866c6b8d90d20e109d62b11f762eeb4c5d72db82177c029a0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'competition_fixture_snapshot',
        columns: [
          col('awayCrestUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('awayName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('awayPenaltyScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('awayProviderId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('awayScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('canonicalMatchId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('competitionId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('homeCrestUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('homeName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('homePenaltyScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('homeProviderId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('homeScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('kickoff', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('leg', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('matchday', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('providerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('round', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('seasonId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('sourceCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('stage', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'competition_fixture_snapshot',
        constraint: 'competition_fixture_snapshot_sourceCode_providerId_key',
        columns: ['sourceCode', 'providerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competition_fixture_snapshot',
        index: 'cfs_season_comp_kickoff_be0b801c',
        columns: ['seasonId', 'competitionId', 'kickoff'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competition_fixture_snapshot',
        index: 'competition_fixture_snapshot_competitionId_idx_53fccd3b',
        columns: ['competitionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'competition_fixture_snapshot',
        index: 'competition_fixture_snapshot_seasonId_idx_aa50cbae',
        columns: ['seasonId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'competition_fixture_snapshot',
        foreignKey: {
          name: 'competition_fixture_snapshot_seasonId_fkey',
          columns: ['seasonId'],
          references: { schema: 'public', table: 'season', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'competition_fixture_snapshot',
        foreignKey: {
          name: 'competition_fixture_snapshot_competitionId_fkey',
          columns: ['competitionId'],
          references: { schema: 'public', table: 'competition', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
