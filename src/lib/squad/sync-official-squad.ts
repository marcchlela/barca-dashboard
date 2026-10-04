import "server-only";

import {
  Temporal,
} from "temporal-polyfill";

import {
  db,
} from "../../prisma/db";

import {
  normalizedPersonName,
  repairMojibake,
} from "../providers/shared/normalization";

import {
  getOfficialSquadManifest,
} from "./official-squad";

import type {
  OfficialSquadPlayer,
} from "./official-squad";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

type CanonicalPlayerPosition =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward"
  | "unknown";

type ExistingCanonicalPlayer = {
  id:
    string;

  firstName:
    string | null;

  lastName:
    string | null;

  displayName:
    string;

  birthDate:
    Temporal.Instant | null;

  nationality:
    string | null;

  primaryPosition:
    CanonicalPlayerPosition;

  preferredFoot:
    string | null;

  portraitUrl:
    string | null;

  isActive:
    boolean;
};

/*
|--------------------------------------------------------------------------
| Official first-team roster reconciliation
|--------------------------------------------------------------------------
|
| The official Barça season manifest owns:
|
| - first-team membership
| - shirt number
| - canonical season position
| - verified core metadata
| - preferred official player portrait
|
| Match providers still own match data, appearances and statistics, but they
| do not own first-team membership or the preferred profile portrait.
|--------------------------------------------------------------------------
*/

export async function syncCurrentBarcelonaOfficialSquad() {
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

  const manifest =
    getOfficialSquadManifest(
      season.label,
    );

  /*
  |--------------------------------------------------------------------------
  | Unknown-season safety
  |--------------------------------------------------------------------------
  */

  if (!manifest) {
    return {
      season:
        season.label,

      supported:
        false,

      expected:
        0,

      resolved:
        0,

      playersCreated:
        0,

      playersUpdated:
        0,

      preferredFootFilled:
        0,

      nationalityFilled:
        0,

      birthDateFilled:
        0,

      portraitFilled:
        0,

      portraitReplaced:
        0,

      membershipsCreated:
        0,

      membershipsUpdated:
        0,

      membershipsReactivated:
        0,

      membershipsClosed:
        0,

      closureSkipped:
        true,

      unresolved:
        [],

      currentRoster:
        [],
    };
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

  const [
    allPlayers,
    memberships,
  ] =
    await Promise.all([
      db.orm.public.Player
        .all(),

      db.orm.public.SquadMembership
        .where({
          seasonId:
            season.id,

          teamId:
            barcelona.id,
        })
        .include(
          "player",
        )
        .all(),
    ]);

  const canonicalPlayers:
    ExistingCanonicalPlayer[] =
    allPlayers;

  const manifestInstant =
    Temporal.Instant.from(
      manifest.verifiedAt,
    );

  const usedPlayerIds =
    new Set<string>();

  const unresolved:
    Array<{
      displayName:
        string;

      reason:
        string;
    }> = [];

  const resolvedEntries:
    Array<{
      definition:
        OfficialSquadPlayer;

      playerId:
        string;
    }> = [];

  let playersCreated =
    0;

  let playersUpdated =
    0;

  let preferredFootFilled =
    0;

  let nationalityFilled =
    0;

  let birthDateFilled =
    0;

  let portraitFilled =
    0;

  let portraitReplaced =
    0;

  let membershipsCreated =
    0;

  let membershipsUpdated =
    0;

  let membershipsReactivated =
    0;

  let membershipsClosed =
    0;

  /*
  |--------------------------------------------------------------------------
  | Resolve official roster
  |--------------------------------------------------------------------------
  */

  for (
    const definition
    of manifest.players
  ) {
    const resolution =
      resolveOfficialPlayer(
        definition,
        canonicalPlayers,
        usedPlayerIds,
      );

    let player =
      resolution.player;

    /*
    |--------------------------------------------------------------------------
    | Create missing canonical player
    |--------------------------------------------------------------------------
    */

    if (
      !player &&
      resolution.reason ===
        "no_existing_canonical_player"
    ) {
      const name =
        splitOfficialName(
          definition.displayName,
        );

      const created =
        await db.orm.public.Player
          .create({
            firstName:
              name.firstName,

            lastName:
              name.lastName,

            displayName:
              definition.displayName,

            birthDate:
              Temporal.Instant.from(
                `${definition.birthDate}T00:00:00Z`,
              ),

            nationality:
              definition.nationality,

            primaryPosition:
              definition.position,

            preferredFoot:
              definition.preferredFoot,

            portraitUrl:
              definition.portraitUrl ??
              null,

            isActive:
              true,
          });

      player =
        created;

      canonicalPlayers.push(
        created,
      );

      playersCreated +=
        1;
    }

    /*
    |--------------------------------------------------------------------------
    | Unsafe ambiguity
    |--------------------------------------------------------------------------
    */

    if (!player) {
      unresolved.push({
        displayName:
          definition.displayName,

        reason:
          resolution.reason,
      });

      continue;
    }

    usedPlayerIds.add(
      player.id,
    );

    resolvedEntries.push({
      definition,

      playerId:
        player.id,
    });

    /*
    |--------------------------------------------------------------------------
    | Existing canonical metadata
    |--------------------------------------------------------------------------
    */

    const existingBirthDate =
      dateKey(
        player.birthDate
          ?.toString() ??
          null,
      );

    const existingNationality =
      meaningfulString(
        player.nationality,
      );

    const existingFoot =
      meaningfulString(
        player.preferredFoot,
      );

    const existingPortrait =
      meaningfulString(
        player.portraitUrl,
      );

    const officialPortrait =
      meaningfulString(
        definition.portraitUrl,
      );

    const existingDisplayName =
      repairMojibake(
        player.displayName,
      );

    /*
    |--------------------------------------------------------------------------
    | Desired canonical values
    |--------------------------------------------------------------------------
    */

    const nextBirthDate =
      player.birthDate ??
      Temporal.Instant.from(
        `${definition.birthDate}T00:00:00Z`,
      );

    const nextNationality =
      existingNationality ??
      definition.nationality;

    const nextPreferredFoot =
      existingFoot ??
      definition.preferredFoot;

    /*
     * Official Barça portrait now has
     * priority over provider portraits.
     */
    const nextPortrait =
      officialPortrait ??
      existingPortrait;

    const nextPosition:
      CanonicalPlayerPosition =
      player.primaryPosition ===
      "unknown"
        ? definition.position
        : player.primaryPosition;

    const nextDisplayName =
      definition.displayName;

    let playerChanged =
      false;

    /*
    |--------------------------------------------------------------------------
    | Name
    |--------------------------------------------------------------------------
    */

    if (
      existingDisplayName !==
        nextDisplayName ||
      player.displayName !==
        nextDisplayName
    ) {
      playerChanged =
        true;
    }

    /*
    |--------------------------------------------------------------------------
    | Birth date
    |--------------------------------------------------------------------------
    */

    if (
      !existingBirthDate
    ) {
      birthDateFilled +=
        1;

      playerChanged =
        true;
    }

    /*
    |--------------------------------------------------------------------------
    | Nationality
    |--------------------------------------------------------------------------
    */

    if (
      !existingNationality
    ) {
      nationalityFilled +=
        1;

      playerChanged =
        true;
    }

    /*
    |--------------------------------------------------------------------------
    | Preferred foot
    |--------------------------------------------------------------------------
    */

    if (
      !existingFoot
    ) {
      preferredFootFilled +=
        1;

      playerChanged =
        true;
    }

    /*
    |--------------------------------------------------------------------------
    | Portrait
    |--------------------------------------------------------------------------
    */

    if (
      !existingPortrait &&
      nextPortrait
    ) {
      portraitFilled +=
        1;

      playerChanged =
        true;
    } else if (
      officialPortrait &&
      officialPortrait !==
        existingPortrait
    ) {
      /*
       * Existing provider portrait is
       * replaced by the official Barça
       * portrait.
       */
      portraitReplaced +=
        1;

      playerChanged =
        true;
    }

    /*
    |--------------------------------------------------------------------------
    | Position
    |--------------------------------------------------------------------------
    */

    if (
      player.primaryPosition ===
        "unknown"
    ) {
      playerChanged =
        true;
    }

    /*
    |--------------------------------------------------------------------------
    | Active state
    |--------------------------------------------------------------------------
    */

    if (
      !player.isActive
    ) {
      playerChanged =
        true;
    }

    /*
    |--------------------------------------------------------------------------
    | Persist player
    |--------------------------------------------------------------------------
    */

    if (
      playerChanged
    ) {
      await db.orm.public.Player
        .where({
          id:
            player.id,
        })
        .update({
          displayName:
            nextDisplayName,

          birthDate:
            nextBirthDate,

          nationality:
            nextNationality,

          preferredFoot:
            nextPreferredFoot,

          portraitUrl:
            nextPortrait,

          primaryPosition:
            nextPosition,

          isActive:
            true,
        });

      playersUpdated +=
        1;
    }

    /*
    |--------------------------------------------------------------------------
    | Official SquadMembership
    |--------------------------------------------------------------------------
    */

    const existingMembership =
      memberships.find(
        (
          membership,
        ) =>
          membership.playerId ===
          player.id,
      );

    if (
      !existingMembership
    ) {
      await db.orm.public.SquadMembership
        .create({
          seasonId:
            season.id,

          teamId:
            barcelona.id,

          playerId:
            player.id,

          shirtNumber:
            definition.shirtNumber,

          position:
            definition.position,

          isCaptain:
            false,

          joinedAt:
            null,

          leftAt:
            null,
        });

      membershipsCreated +=
        1;

      continue;
    }

    const wasClosed =
      existingMembership.leftAt !==
      null;

    const needsMembershipUpdate =
      existingMembership.shirtNumber !==
        definition.shirtNumber ||
      existingMembership.position !==
        definition.position ||
      wasClosed;

    if (
      !needsMembershipUpdate
    ) {
      continue;
    }

    await db.orm.public.SquadMembership
      .where({
        id:
          existingMembership.id,
      })
      .update({
        shirtNumber:
          definition.shirtNumber,

        position:
          definition.position,

        /*
         * Captain state is reconciled
         * after this operation.
         */
        isCaptain:
          existingMembership
            .isCaptain,

        leftAt:
          null,
      });

    membershipsUpdated +=
      1;

    if (
      wasClosed
    ) {
      membershipsReactivated +=
        1;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Close stale memberships
  |--------------------------------------------------------------------------
  */

  const closureSkipped =
    unresolved.length >
    0;

  if (
    !closureSkipped
  ) {
    for (
      const membership
      of memberships
    ) {
      if (
        usedPlayerIds.has(
          membership.playerId,
        )
      ) {
        continue;
      }

      if (
        !membershipIsCurrent(
          membership.leftAt
            ?.toString() ??
            null,
        )
      ) {
        continue;
      }

      await db.orm.public.SquadMembership
        .where({
          id:
            membership.id,
        })
        .update({
          leftAt:
            manifestInstant,

          isCaptain:
            false,
        });

      membershipsClosed +=
        1;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Result
  |--------------------------------------------------------------------------
  */

  return {
    season:
      season.label,

    supported:
      true,

    verifiedAt:
      manifest.verifiedAt,

    expected:
      manifest.players.length,

    resolved:
      resolvedEntries.length,

    playersCreated,

    playersUpdated,

    preferredFootFilled,

    nationalityFilled,

    birthDateFilled,

    portraitFilled,

    portraitReplaced,

    membershipsCreated,

    membershipsUpdated,

    membershipsReactivated,

    membershipsClosed,

    closureSkipped,

    unresolved,

    currentRoster:
      resolvedEntries
        .sort(
          (
            left,
            right,
          ) =>
            left.definition
              .shirtNumber -
            right.definition
              .shirtNumber,
        )
        .map(
          (
            entry,
          ) => ({
            playerId:
              entry.playerId,

            name:
              entry.definition
                .displayName,

            number:
              entry.definition
                .shirtNumber,

            position:
              entry.definition
                .position,

            preferredFoot:
              entry.definition
                .preferredFoot,

            portraitSource:
              entry.definition
                .portraitUrl
                ? "fc-barcelona-official"
                : "provider",
          }),
        ),
  };
}

/*
|--------------------------------------------------------------------------
| Existing canonical identity resolution
|--------------------------------------------------------------------------
*/

function resolveOfficialPlayer(
  definition:
    OfficialSquadPlayer,

  players:
    ExistingCanonicalPlayer[],

  usedPlayerIds:
    Set<string>,
) {
  const available =
    players.filter(
      (
        player,
      ) =>
        !usedPlayerIds.has(
          player.id,
        ),
    );

  const aliases =
    new Set(
      [
        definition.displayName,
        ...definition.aliases,
      ].map(
        normalizeName,
      ),
    );

  /*
  |--------------------------------------------------------------------------
  | Exact name / alias
  |--------------------------------------------------------------------------
  */

  const nameMatches =
    available.filter(
      (
        player,
      ) =>
        playerIdentityCandidates(
          player,
        ).some(
          (
            candidate,
          ) =>
            aliases.has(
              candidate,
            ),
        ),
    );

  if (
    nameMatches.length ===
    1
  ) {
    return {
      player:
        nameMatches[0],

      reason:
        "",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | DOB fallback
  |--------------------------------------------------------------------------
  */

  const dobMatches =
    available.filter(
      (
        player,
      ) =>
        dateKey(
          player.birthDate
            ?.toString() ??
            null,
        ) ===
        definition.birthDate,
    );

  if (
    dobMatches.length ===
    1
  ) {
    return {
      player:
        dobMatches[0],

      reason:
        "",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Ambiguous name + DOB
  |--------------------------------------------------------------------------
  */

  if (
    nameMatches.length >
    1
  ) {
    const exactDob =
      nameMatches.filter(
        (
          player,
        ) =>
          dateKey(
            player.birthDate
              ?.toString() ??
              null,
          ) ===
          definition.birthDate,
      );

    if (
      exactDob.length ===
      1
    ) {
      return {
        player:
          exactDob[0],

        reason:
          "",
      };
    }

    return {
      player:
        null,

      reason:
        "ambiguous_name_identity",
    };
  }

  if (
    dobMatches.length >
    1
  ) {
    return {
      player:
        null,

      reason:
        "ambiguous_birth_date_identity",
    };
  }

  return {
    player:
      null,

    reason:
      "no_existing_canonical_player",
  };
}

/*
|--------------------------------------------------------------------------
| Identity candidates
|--------------------------------------------------------------------------
*/

function playerIdentityCandidates(
  player: {
    firstName:
      string | null;

    lastName:
      string | null;

    displayName:
      string;
  },
) {
  const values =
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
      values.add(
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
    values,
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
| Official name bootstrap
|--------------------------------------------------------------------------
*/

function splitOfficialName(
  displayName:
    string,
) {
  const parts =
    displayName
      .trim()
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      );

  if (
    parts.length ===
    0
  ) {
    return {
      firstName:
        null,

      lastName:
        null,
    };
  }

  if (
    parts.length ===
    1
  ) {
    return {
      firstName:
        parts[0],

      lastName:
        null,
    };
  }

  return {
    firstName:
      parts[0],

    lastName:
      parts
        .slice(
          1,
        )
        .join(
          " ",
        ),
  };
}

/*
|--------------------------------------------------------------------------
| Current membership
|--------------------------------------------------------------------------
*/

function membershipIsCurrent(
  leftAt:
    string | null,
) {
  if (!leftAt) {
    return true;
  }

  const timestamp =
    new Date(
      leftAt,
    ).getTime();

  if (
    !Number.isFinite(
      timestamp,
    )
  ) {
    return false;
  }

  return (
    timestamp >
    Date.now()
  );
}

/*
|--------------------------------------------------------------------------
| Metadata helpers
|--------------------------------------------------------------------------
*/

function meaningfulString(
  value:
    string | null |
    undefined,
) {
  if (
    !value ||
    !value.trim()
  ) {
    return null;
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized ===
      "unknown" ||
    normalized ===
      "n/a" ||
    normalized ===
      "null"
  ) {
    return null;
  }

  return value.trim();
}

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