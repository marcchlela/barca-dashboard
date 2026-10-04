import {
  NextResponse,
} from "next/server";

import {
  db,
} from "../../../../prisma/db";

import {
  repairMojibake,
} from "../../../../lib/providers/shared/normalization";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export async function GET() {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Squad audit is disabled in production until admin authentication is added.",
      },
      {
        status:
          404,
      },
    );
  }

  try {
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

    const [
      memberships,
      playerMappings,
    ] =
      await Promise.all([
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

        db.orm.public.ProviderMapping
          .where({
            entityType:
              "player",
          })
          .include(
            "dataSource",
          )
          .all(),
      ]);

    const now =
      Date.now();

    const currentMemberships =
      memberships.filter(
        (
          membership,
        ) => {
          if (
            !membership.player
              .isActive
          ) {
            return false;
          }

          if (
            !membership.leftAt
          ) {
            return true;
          }

          return (
            new Date(
              membership.leftAt
                .toString(),
            ).getTime() >
            now
          );
        },
      );

    const mappingsByPlayer =
      new Map<
        string,
        Array<{
          source:
            string;

          providerId:
            string;
        }>
      >();

    for (
      const mapping
      of playerMappings
    ) {
      const current =
        mappingsByPlayer.get(
          mapping.internalId,
        ) ??
        [];

      current.push({
        source:
          mapping.dataSource
            .code,

        providerId:
          mapping.providerId,
      });

      mappingsByPlayer.set(
        mapping.internalId,
        current,
      );
    }

    const players =
      currentMemberships
        .map(
          (
            membership,
          ) => {
            const player =
              membership.player;

            const birthDate =
              player.birthDate
                ? dateKey(
                    player.birthDate
                      .toString(),
                  )
                : null;

            const nationality =
              meaningfulString(
                player.nationality,
              );

            const preferredFoot =
              meaningfulString(
                player.preferredFoot,
              );

            const portraitUrl =
              meaningfulString(
                player.portraitUrl,
              );

            return {
              id:
                player.id,

              name:
                repairMojibake(
                  player.displayName,
                ),

              shirtNumber:
                membership.shirtNumber,

              position:
                membership.position !==
                "unknown"
                  ? membership.position
                  : player.primaryPosition,

              captain:
                membership.isCaptain,

              birthDate,

              nationality,

              preferredFoot,

              portrait: {
                present:
                  Boolean(
                    portraitUrl,
                  ),

                host:
                  portraitHost(
                    portraitUrl,
                  ),

                url:
                  portraitUrl,
              },

              mappings:
                (
                  mappingsByPlayer.get(
                    player.id,
                  ) ??
                  []
                )
                  .sort(
                    (
                      left,
                      right,
                    ) =>
                      left.source.localeCompare(
                        right.source,
                      ),
                  ),
            };
          },
        )
        .sort(
          (
            left,
            right,
          ) => {
            const leftNumber =
              left.shirtNumber ??
              999;

            const rightNumber =
              right.shirtNumber ??
              999;

            if (
              leftNumber !==
              rightNumber
            ) {
              return (
                leftNumber -
                rightNumber
              );
            }

            return left.name.localeCompare(
              right.name,
            );
          },
        );

    const missingBirthDate =
      players
        .filter(
          (
            player,
          ) =>
            !player.birthDate,
        )
        .map(
          (
            player,
          ) =>
            player.name,
        );

    const missingNationality =
      players
        .filter(
          (
            player,
          ) =>
            !player.nationality,
        )
        .map(
          (
            player,
          ) =>
            player.name,
        );

    const missingPreferredFoot =
      players
        .filter(
          (
            player,
          ) =>
            !player.preferredFoot,
        )
        .map(
          (
            player,
          ) =>
            player.name,
        );

    const missingPortrait =
      players
        .filter(
          (
            player,
          ) =>
            !player.portrait
              .present,
        )
        .map(
          (
            player,
          ) =>
            player.name,
        );

    const unknownPosition =
      players
        .filter(
          (
            player,
          ) =>
            player.position ===
            "unknown",
        )
        .map(
          (
            player,
          ) =>
            player.name,
        );

    const captains =
      players
        .filter(
          (
            player,
          ) =>
            player.captain,
        )
        .map(
          (
            player,
          ) =>
            player.name,
        );

    const portraitHosts =
      players.reduce<
        Record<
          string,
          number
        >
      >(
        (
          result,
          player,
        ) => {
          const host =
            player.portrait
              .host ??
            "none";

          result[
            host
          ] =
            (
              result[
                host
              ] ??
              0
            ) +
            1;

          return result;
        },
        {},
      );

    return NextResponse.json({
      ok:
        true,

      season:
        season.label,

      generatedAt:
        new Date()
          .toISOString(),

      summary: {
        currentSquad:
          players.length,

        captains:
          captains.length,

        missingBirthDate:
          missingBirthDate
            .length,

        missingNationality:
          missingNationality
            .length,

        missingPreferredFoot:
          missingPreferredFoot
            .length,

        missingPortrait:
          missingPortrait
            .length,

        unknownPosition:
          unknownPosition
            .length,
      },

      missing: {
        birthDate:
          missingBirthDate,

        nationality:
          missingNationality,

        preferredFoot:
          missingPreferredFoot,

        portrait:
          missingPortrait,

        position:
          unknownPosition,
      },

      captains,

      portraitHosts,

      players,
    });
  } catch (
    error
  ) {
    console.error(
      "SQUAD AUDIT FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      },
      {
        status:
          500,
      },
    );
  }
}

/*
|--------------------------------------------------------------------------
| Helpers
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
    string,
) {
  const match =
    value.match(
      /(\d{4})-(\d{2})-(\d{2})/,
    );

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function portraitHost(
  value:
    string | null,
) {
  if (!value) {
    return null;
  }

  try {
    return new URL(
      value,
    ).hostname;
  } catch {
    return "invalid-url";
  }
}