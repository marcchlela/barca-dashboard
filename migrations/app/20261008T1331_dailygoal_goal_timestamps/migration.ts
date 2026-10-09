#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/54a1195aed4cda88ea25ac558f929b76a2987c4ba5faee8210f17b801ec03a3d/contract';
import startContract from '../../snapshots/54a1195aed4cda88ea25ac558f929b76a2987c4ba5faee8210f17b801ec03a3d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f50957aea55f0addd7af62a103ee49f487db6da54f243f6f908af15a5c6712c9/contract';
import endContract from '../../snapshots/f50957aea55f0addd7af62a103ee49f487db6da54f243f6f908af15a5c6712c9/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'goal_timestamp_candidate',
        columns: [
          col('clipUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('confidence', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('matchEventId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('matchId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('mediaItemId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('minute', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reasons', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('reviewNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reviewedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('scorer', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sourceSecond', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sourceUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startSecond', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('videoId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'goal_timestamp_candidate_status_check_19a2b525',
            "\"status\" IN ('pending', 'approved', 'rejected')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'media_moment',
        column: col('verificationBasis', 'text', {
          notNull: true,
          default: lit('manual_visual'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'goal_timestamp_candidate',
        constraint: 'goal_timestamp_candidate_clipUrl_key',
        columns: ['clipUrl'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'goal_timestamp_candidate',
        index: 'goal_timestamp_candidate_matchEventId_idx_8e4b5b2a',
        columns: ['matchEventId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'goal_timestamp_candidate',
        index: 'goal_timestamp_candidate_matchId_idx_4caf5ecc',
        columns: ['matchId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'goal_timestamp_candidate',
        index: 'goal_timestamp_candidate_matchId_status_idx_d47c0c0a',
        columns: ['matchId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'goal_timestamp_candidate',
        index: 'goal_timestamp_candidate_mediaItemId_idx_5e6c7760',
        columns: ['mediaItemId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'goal_timestamp_candidate',
        index: 'goal_timestamp_candidate_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'goal_timestamp_candidate',
        foreignKey: {
          name: 'goal_timestamp_candidate_matchId_fkey',
          columns: ['matchId'],
          references: { schema: 'public', table: 'football_match', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'goal_timestamp_candidate',
        foreignKey: {
          name: 'goal_timestamp_candidate_mediaItemId_fkey',
          columns: ['mediaItemId'],
          references: { schema: 'public', table: 'media_item', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'goal_timestamp_candidate',
        foreignKey: {
          name: 'goal_timestamp_candidate_matchEventId_fkey',
          columns: ['matchEventId'],
          references: { schema: 'public', table: 'match_event', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
