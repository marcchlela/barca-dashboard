import "server-only";

import {
  db,
} from "../../prisma/db";

import {
  normalizedPersonName,
  repairMojibake,
} from "../providers/shared/normalization";

type CaptainDefinition = {
  label:
    string;

  aliases:
    string[];
};

/*
|--------------------------------------------------------------------------
| Verified seasonal leadership
|--------------------------------------------------------------------------
|
| SquadMembership currently has a boolean isCaptain rather than an ordered
| captain hierarchy, so this represents membership of the captain group.
|--------------------------------------------------------------------------
*/

const CAPTAIN_GROUPS:
  Record<
    string,
    CaptainDefinition[]
  > = {
    "2026/27": [
      {
        label:
          "Raphinha",

        aliases: [
          "Raphinha",
          "Raphael Dias Belloli",
          "Raphael Dias",
        ],
      },

      {
        label:
          "Pedri",

        aliases: [
          "Pedri",
          "Pedro Gonzalez",
          "Pedro Gonzalez Lopez",
        ],
      },

      {
        label:
          "Eric Garcia",

        aliases: [
          "Eric Garcia",
          "Eric Garcia Martret",
          "Eric",
        ],
      },

      {
        label:
          "Frenkie de Jong",

        aliases: [
          "Frenkie de Jong",
          "Frenkie",
          "De Jong",
        ],
      },

      {
        label:
          "Lamine Yamal",

        aliases: [
          "Lamine Yamal",
          "Lamine",
          "Lamine Yamal Nasraoui Ebana",
        ],
      },
    ],
  };

export async function syncCurrentBarcelonaCaptains() {
  const season =
    await db.orm.public.Season
      .where({
        isCurrent:
          true,
      })
      .first();

  if (!season) {
    throw new Error(
      "No current season exists.",
    );
  }

  const barcelona =
    await db.orm.public.Team
      .where({
        isBarcelona:
          true,
      })
      .first();

  if (!barcelona) {
    throw new Error(
      "FC Barcelona was not found.",
    );
  }

  const definitions =
    CAPTAIN_GROUPS[
      season.label
    ];

  /*
  |--------------------------------------------------------------------------
  | Do not guess unknown seasons
  |--------------------------------------------------------------------------
  */

  if (!definitions) {
    return {
      season:
        season.label,

      supported:
        false,

      updated:
        0,

      captains:
        [],

      unresolved:
        [],
    };
  }

  const memberships =
    await db.orm.public.SquadMembership
      .where({
        seasonId:
          season.id,

        teamId:
          barcelona.id,
      })
      .include(
        "player",
      )
      .all();

  /*
  |--------------------------------------------------------------------------
  | Resolve definitions
  |--------------------------------------------------------------------------
  */

  const resolvedPlayerIds =
    new Set<string>();

  const resolvedCaptains:
    string[] =
    [];

  const unresolved:
    string[] =
    [];

  for (
    const definition
    of definitions
  ) {
    const aliases =
      new Set(
        definition.aliases.map(
          normalizeName,
        ),
      );

    const matches =
      memberships.filter(
        (
          membership,
        ) => {
          const player =
            membership.player;

          const candidates =
            playerNameCandidates(
              player,
            );

          return candidates.some(
            (
              candidate,
            ) =>
              aliases.has(
                candidate,
              ),
          );
        },
      );

    if (
      matches.length !==
      1
    ) {
      unresolved.push(
        definition.label,
      );

      continue;
    }

    const membership =
      matches[0];

    resolvedPlayerIds.add(
      membership.playerId,
    );

    resolvedCaptains.push(
      repairMojibake(
        membership.player
          .displayName,
      ),
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Persist captain-group booleans
  |--------------------------------------------------------------------------
  */

  let updated =
    0;

  for (
    const membership
    of memberships
  ) {
    const shouldBeCaptain =
      resolvedPlayerIds.has(
        membership.playerId,
      );

    if (
      membership.isCaptain ===
      shouldBeCaptain
    ) {
      continue;
    }

    await db.orm.public.SquadMembership
      .where({
        id:
          membership.id,
      })
      .update({
        isCaptain:
          shouldBeCaptain,
      });

    updated +=
      1;
  }

  return {
    season:
      season.label,

    supported:
      true,

    updated,

    captains:
      resolvedCaptains,

    unresolved,
  };
}

/*
|--------------------------------------------------------------------------
| Name candidates
|--------------------------------------------------------------------------
*/

function playerNameCandidates(
  player: {
    displayName:
      string;

    firstName:
      string | null;

    lastName:
      string | null;
  },
) {
  const candidates =
    new Set<string>();

  function add(
    value:
      string | null |
      undefined,
  ) {
    if (!value) {
      return;
    }

    const normalized =
      normalizeName(
        value,
      );

    if (
      normalized
    ) {
      candidates.add(
        normalized,
      );
    }
  }

  add(
    player.displayName,
  );

  add(
    player.firstName,
  );

  add(
    player.lastName,
  );

  if (
    player.firstName &&
    player.lastName
  ) {
    add(
      `${player.firstName} ${player.lastName}`,
    );
  }

  return Array.from(
    candidates,
  );
}

function normalizeName(
  value:
    string,
) {
  return normalizedPersonName(
    repairMojibake(
      value,
    ),
  );
}