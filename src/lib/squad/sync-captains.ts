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

  birthDate:
    string;
};

/*
|--------------------------------------------------------------------------
| Verified seasonal leadership
|--------------------------------------------------------------------------
|
| SquadMembership currently stores a boolean isCaptain rather than captain
| order, so these are members of the season's captain group.
|
| DOB is used only as a hard identity fallback when provider/canonical naming
| differs unexpectedly.
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

        birthDate:
          "1996-12-14",

        aliases: [
          "Raphinha",
          "Raphael Dias Belloli",
          "Raphael Dias",
        ],
      },

      {
        label:
          "Pedri",

        birthDate:
          "2002-11-25",

        aliases: [
          "Pedri",
          "Pedro Gonzalez",
          "Pedro Gonzalez Lopez",
        ],
      },

      {
        label:
          "Eric Garcia",

        birthDate:
          "2001-01-09",

        aliases: [
          "Eric Garcia",
          "Eric Garcia Martret",
          "Eric",
        ],
      },

      {
        label:
          "Frenkie de Jong",

        birthDate:
          "1997-05-12",

        aliases: [
          "Frenkie de Jong",
          "Frenkie",
          "De Jong",
        ],
      },

      {
        label:
          "Lamine Yamal",

        birthDate:
          "2007-07-13",

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

  const resolvedPlayerIds =
    new Set<string>();

  const resolvedCaptains:
    string[] =
    [];

  const unresolved:
    string[] =
    [];

  /*
  |--------------------------------------------------------------------------
  | Resolve each captain
  |--------------------------------------------------------------------------
  */

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

    /*
     * First choice:
     *
     * canonical/provider naming
     */

    let matches =
      memberships.filter(
        (
          membership,
        ) => {
          const candidates =
            playerNameCandidates(
              membership.player,
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

    /*
     * Hard fallback:
     *
     * unique date of birth in the
     * current Barça squad.
     *
     * This safely handles strange name
     * formatting without fuzzy guessing.
     */

    if (
      matches.length !==
      1
    ) {
      matches =
        memberships.filter(
          (
            membership,
          ) =>
            dateKey(
              membership.player
                .birthDate
                ?.toString() ??
                null,
            ) ===
            definition.birthDate,
        );
    }

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

/*
|--------------------------------------------------------------------------
| Date identity
|--------------------------------------------------------------------------
*/

function dateKey(
  value:
    string | null |
    undefined,
) {
  if (!value) {
    return null;
  }

  const match =
    value.match(
      /(\d{4})-(\d{2})-(\d{2})/,
    );

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}