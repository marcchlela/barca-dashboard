#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/21d76fd9260385074e2e65907b43639a7830b3829f194093c0afdaf5e9b47cdc/contract';
import endContract from '../../snapshots/21d76fd9260385074e2e65907b43639a7830b3829f194093c0afdaf5e9b47cdc/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e9a321e0128d5fa8b40bbf364f27c36558c7366f06af3ed74e7b663665eea857/contract';
import startContract from '../../snapshots/e9a321e0128d5fa8b40bbf364f27c36558c7366f06af3ed74e7b663665eea857/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'notification_cursor',
        columns: [
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('snapshot', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['key'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'notification_delivery',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('errorCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('eventId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('sentAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subscriptionId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'notification_event',
        columns: [
          col('audience', 'text', {
            notNull: true,
            default: lit('supporters'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('iconUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('matchId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'notification_preference',
        columns: [
          col('enabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'notification_template',
        columns: [
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['kind'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'push_subscription',
        columns: [
          col('auth', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('disabledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('endpoint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('p256dh', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'notification_delivery',
        constraint: 'notification_delivery_eventId_subscriptionId_key',
        columns: ['eventId', 'subscriptionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'notification_event',
        constraint: 'notification_event_key_key',
        columns: ['key'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'notification_preference',
        constraint: 'notification_preference_userId_kind_key',
        columns: ['userId', 'kind'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'push_subscription',
        constraint: 'push_subscription_endpoint_key',
        columns: ['endpoint'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification_delivery',
        index: 'notification_delivery_eventId_idx_6a266d47',
        columns: ['eventId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification_delivery',
        index: 'notification_delivery_status_createdAt_idx_58610442',
        columns: ['status', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification_delivery',
        index: 'notification_delivery_subscriptionId_idx_edbe96bf',
        columns: ['subscriptionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification_event',
        index: 'notification_event_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification_event',
        index: 'notification_event_kind_createdAt_idx_a3b548ae',
        columns: ['kind', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification_preference',
        index: 'notification_preference_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'push_subscription',
        index: 'push_subscription_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notification_delivery',
        foreignKey: {
          name: 'notification_delivery_eventId_fkey',
          columns: ['eventId'],
          references: { schema: 'public', table: 'notification_event', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notification_delivery',
        foreignKey: {
          name: 'notification_delivery_subscriptionId_fkey',
          columns: ['subscriptionId'],
          references: { schema: 'public', table: 'push_subscription', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notification_preference',
        foreignKey: {
          name: 'notification_preference_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'push_subscription',
        foreignKey: {
          name: 'push_subscription_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
