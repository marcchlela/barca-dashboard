#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/54a1195aed4cda88ea25ac558f929b76a2987c4ba5faee8210f17b801ec03a3d/contract';
import endContract from '../../snapshots/54a1195aed4cda88ea25ac558f929b76a2987c4ba5faee8210f17b801ec03a3d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/91aab35b1de35c807eb7e8eab4b47bdc55fb63e01953d7507ecd7ded9e6189c2/contract';
import startContract from '../../snapshots/91aab35b1de35c807eb7e8eab4b47bdc55fb63e01953d7507ecd7ded9e6189c2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'media_moment',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('endSecond', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('evidenceUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('matchEventId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('mediaItemId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('reviewNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startSecond', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('verifiedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'media_save',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('favourite', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('mediaItemId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('watchLater', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'media_item',
        column: col('featuredAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'media_moment',
        constraint: 'media_moment_mediaItemId_matchEventId_key',
        columns: ['mediaItemId', 'matchEventId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'media_save',
        constraint: 'media_save_mediaItemId_key',
        columns: ['mediaItemId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'media_moment',
        index: 'media_moment_matchEventId_idx_8e4b5b2a',
        columns: ['matchEventId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'media_moment',
        index: 'media_moment_mediaItemId_idx_5e6c7760',
        columns: ['mediaItemId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'media_moment',
        foreignKey: {
          name: 'media_moment_mediaItemId_fkey',
          columns: ['mediaItemId'],
          references: { schema: 'public', table: 'media_item', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'media_moment',
        foreignKey: {
          name: 'media_moment_matchEventId_fkey',
          columns: ['matchEventId'],
          references: { schema: 'public', table: 'match_event', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'media_save',
        foreignKey: {
          name: 'media_save_mediaItemId_fkey',
          columns: ['mediaItemId'],
          references: { schema: 'public', table: 'media_item', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
