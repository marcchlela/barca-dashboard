#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6556dd3eff7b2c4e96bb1d824c445291f6e47fafcc42cff0509497cb3e450878/contract';
import endContract from '../../snapshots/6556dd3eff7b2c4e96bb1d824c445291f6e47fafcc42cff0509497cb3e450878/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f6097504120286aca553e1ede724057f6150800b76a93503305c0fc785245fd4/contract';
import startContract from '../../snapshots/f6097504120286aca553e1ede724057f6150800b76a93503305c0fc785245fd4/contract.json' with { type: 'json' };
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
      this.dropConstraint({
        schema: 'public',
        table: 'favourite_match',
        constraint: 'favourite_match_matchId_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'favourite_match',
        constraint: 'favourite_match_seasonId_slot_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'favourite_player',
        constraint: 'favourite_player_playerId_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'match_diary_entry',
        constraint: 'match_diary_entry_matchId_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'media_save',
        constraint: 'media_save_mediaItemId_key',
      }),
      this.createTable({
        schema: 'public',
        table: 'app_user',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('user'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('app_user_role_check_5b6d1a59', "\"role\" IN ('user', 'admin')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'auth_throttle',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('blockedUntil', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('windowStart', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['key'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'user_session',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'favourite_match',
        column: col('userId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'favourite_player',
        column: col('userId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'match_diary_entry',
        column: col('userId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'media_save',
        column: col('userId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'app_user',
        constraint: 'app_user_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'app_user',
        constraint: 'app_user_username_key',
        columns: ['username'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'favourite_match',
        constraint: 'favourite_match_userId_matchId_key',
        columns: ['userId', 'matchId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'favourite_match',
        constraint: 'favourite_match_userId_seasonId_slot_key',
        columns: ['userId', 'seasonId', 'slot'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'favourite_player',
        constraint: 'favourite_player_userId_playerId_key',
        columns: ['userId', 'playerId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'match_diary_entry',
        constraint: 'match_diary_entry_userId_matchId_key',
        columns: ['userId', 'matchId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'media_save',
        constraint: 'media_save_userId_mediaItemId_key',
        columns: ['userId', 'mediaItemId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user_session',
        constraint: 'user_session_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favourite_match',
        index: 'favourite_match_matchId_idx_4caf5ecc',
        columns: ['matchId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favourite_match',
        index: 'favourite_match_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favourite_player',
        index: 'favourite_player_playerId_idx_710cf1aa',
        columns: ['playerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favourite_player',
        index: 'favourite_player_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'match_diary_entry',
        index: 'match_diary_entry_matchId_idx_4caf5ecc',
        columns: ['matchId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'match_diary_entry',
        index: 'match_diary_entry_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'media_save',
        index: 'media_save_mediaItemId_idx_5e6c7760',
        columns: ['mediaItemId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'media_save',
        index: 'media_save_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user_session',
        index: 'user_session_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user_session',
        index: 'user_session_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favourite_match',
        foreignKey: {
          name: 'favourite_match_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favourite_player',
        foreignKey: {
          name: 'favourite_player_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'match_diary_entry',
        foreignKey: {
          name: 'match_diary_entry_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'media_save',
        foreignKey: {
          name: 'media_save_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'user_session',
        foreignKey: {
          name: 'user_session_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
