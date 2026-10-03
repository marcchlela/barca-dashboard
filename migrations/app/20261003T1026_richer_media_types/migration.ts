#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/adc58e3b93370e080f82bbf60683c43f566a9ce68f6849e8465736e3c736bd58/contract';
import startContract from '../../snapshots/adc58e3b93370e080f82bbf60683c43f566a9ce68f6849e8465736e3c736bd58/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f64562ada54d6648dbe850b4390eeeecf0279a74d9d50886a664aad1cae62da1/contract';
import endContract from '../../snapshots/f64562ada54d6648dbe850b4390eeeecf0279a74d9d50886a664aad1cae62da1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'media_item',
        constraint: 'media_item_type_check_0b2bf1f8',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'media_review_candidate',
        constraint: 'media_review_candidate_type_check_0b2bf1f8',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'media_item',
        constraint: 'media_item_type_check_4eb91d94',
        expression:
          "\"type\" IN ('match_highlight', 'match_feature', 'match_preview', 'goal_clip', 'interview', 'press_conference', 'training', 'historical', 'other')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'media_review_candidate',
        constraint: 'media_review_candidate_type_check_4eb91d94',
        expression:
          "\"type\" IN ('match_highlight', 'match_feature', 'match_preview', 'goal_clip', 'interview', 'press_conference', 'training', 'historical', 'other')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
