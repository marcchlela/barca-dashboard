#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/f50957aea55f0addd7af62a103ee49f487db6da54f243f6f908af15a5c6712c9/contract';
import startContract from '../../snapshots/f50957aea55f0addd7af62a103ee49f487db6da54f243f6f908af15a5c6712c9/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f6097504120286aca553e1ede724057f6150800b76a93503305c0fc785245fd4/contract';
import endContract from '../../snapshots/f6097504120286aca553e1ede724057f6150800b76a93503305c0fc785245fd4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'goal_media_page_cache',
        columns: [
          col('checkedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('matchId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'goal_media_sync_run',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('finishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('fixturesChecked', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('goalsPublished', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('goalsQueued', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lockKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('missingCoverage', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('mode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('result', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('startedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'goal_media_sync_state',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('goalsCovered', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('goalsTotal', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastCheckedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastVideoId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('matchId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('nextRetryAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('reviewPending', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('sourceUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'goal_media_page_cache',
        constraint: 'goal_media_page_cache_url_key',
        columns: ['url'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'goal_media_sync_run',
        constraint: 'goal_media_sync_run_lockKey_key',
        columns: ['lockKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'goal_media_sync_state',
        constraint: 'goal_media_sync_state_matchId_key',
        columns: ['matchId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'goal_media_page_cache',
        index: 'goal_media_page_cache_matchId_idx_4caf5ecc',
        columns: ['matchId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'goal_media_sync_run',
        index: 'goal_media_sync_run_startedAt_idx_cac56236',
        columns: ['startedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'goal_media_sync_state',
        index: 'goal_media_sync_state_status_nextRetryAt_idx_58d36316',
        columns: ['status', 'nextRetryAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'goal_media_page_cache',
        foreignKey: {
          name: 'goal_media_page_cache_matchId_fkey',
          columns: ['matchId'],
          references: { schema: 'public', table: 'football_match', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'goal_media_sync_state',
        foreignKey: {
          name: 'goal_media_sync_state_matchId_fkey',
          columns: ['matchId'],
          references: { schema: 'public', table: 'football_match', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
