#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/ab80e523f0f42c7647e39a2c23ef6b102102f5b0f68a5f04b61bbce06c2326a4/contract';
import startContract from '../../snapshots/ab80e523f0f42c7647e39a2c23ef6b102102f5b0f68a5f04b61bbce06c2326a4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/adc58e3b93370e080f82bbf60683c43f566a9ce68f6849e8465736e3c736bd58/contract';
import endContract from '../../snapshots/adc58e3b93370e080f82bbf60683c43f566a9ce68f6849e8465736e3c736bd58/contract.json' with { type: 'json' };
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
        table: 'media_review_candidate',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('dataSourceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('durationSeconds', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('embeddable', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('externalMediaId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastSeenAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('matchId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('publishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('reasons', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('reviewNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reviewedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('score', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('seasonId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('thumbnailUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'media_review_candidate_status_check_19a2b525',
            "\"status\" IN ('pending', 'approved', 'rejected')",
          ),
          checkExpression(
            'media_review_candidate_type_check_0b2bf1f8',
            "\"type\" IN ('match_highlight', 'goal_clip', 'interview', 'press_conference', 'training', 'historical', 'other')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'media_review_candidate',
        constraint: 'media_review_candidate_dataSourceId_externalMediaId_matchId_key',
        columns: ['dataSourceId', 'externalMediaId', 'matchId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'media_review_candidate',
        index: 'media_review_candidate_dataSourceId_idx_536a4d74',
        columns: ['dataSourceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'media_review_candidate',
        index: 'media_review_candidate_matchId_idx_4caf5ecc',
        columns: ['matchId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'media_review_candidate',
        index: 'media_review_candidate_seasonId_idx_aa50cbae',
        columns: ['seasonId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'media_review_candidate',
        index: 'media_review_candidate_seasonId_status_idx_0da2dd50',
        columns: ['seasonId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'media_review_candidate',
        index: 'media_review_candidate_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'media_review_candidate',
        foreignKey: {
          name: 'media_review_candidate_seasonId_fkey',
          columns: ['seasonId'],
          references: { schema: 'public', table: 'season', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'media_review_candidate',
        foreignKey: {
          name: 'media_review_candidate_matchId_fkey',
          columns: ['matchId'],
          references: { schema: 'public', table: 'football_match', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'media_review_candidate',
        foreignKey: {
          name: 'media_review_candidate_dataSourceId_fkey',
          columns: ['dataSourceId'],
          references: { schema: 'public', table: 'data_source', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
