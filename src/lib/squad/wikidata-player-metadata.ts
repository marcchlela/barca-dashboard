import "server-only";

import {
  normalizedPersonName,
} from "../providers/shared/normalization";

type SearchItem = {
  id:
    string;

  label?:
    string;

  description?:
    string;
};

type SearchResponse = {
  search?:
    SearchItem[];
};

type DataValue = {
  value?:
    unknown;
};

type Snak = {
  datavalue?:
    DataValue;
};

type Claim = {
  mainsnak?:
    Snak;
};

type Entity = {
  id?:
    string;

  labels?: {
    en?: {
      language?:
        string;

      value?:
        string;
    };
  };

  claims?: Record<
    string,
    Claim[]
  >;
};

type EntityResponse = {
  entities?:
    Record<
      string,
      Entity
    >;
};

export type WikidataPlayerMetadata = {
  entityId:
    string;

  nationality:
    string | null;

  preferredFoot:
    "left" | "right" | "both" | null;
};

const cache =
  new Map<
    string,
    WikidataPlayerMetadata | null
  >();

const LEFT_FOOTED =
  "Q2183543";

const RIGHT_FOOTED =
  "Q1843233";

const BOTH_FOOTED =
  "Q136817382";

export async function fetchWikidataPlayerMetadata({
  name,
  birthDate,
}: {
  name:
    string;

  birthDate:
    string;
}): Promise<
  WikidataPlayerMetadata | null
> {
  const date =
    dateKey(
      birthDate,
    );

  if (!date) {
    return null;
  }

  const cacheKey =
    `${normalizedPersonName(
      name,
    )}:${date}`;

  if (
    cache.has(
      cacheKey,
    )
  ) {
    return (
      cache.get(
        cacheKey,
      ) ??
      null
    );
  }

  try {
    /*
    |--------------------------------------------------------------------------
    | Search
    |--------------------------------------------------------------------------
    */

    const searchUrl =
      new URL(
        "https://www.wikidata.org/w/api.php",
      );

    searchUrl.search =
      new URLSearchParams({
        action:
          "wbsearchentities",

        search:
          name,

        language:
          "en",

        uselang:
          "en",

        type:
          "item",

        limit:
          "8",

        format:
          "json",

        origin:
          "*",
      }).toString();

    const searchResponse =
      await fetch(
        searchUrl,
        {
          headers: {
            "User-Agent":
              "barca-dashboard/0.1 personal-project",
          },

          cache:
            "no-store",
        },
      );

    if (
      !searchResponse.ok
    ) {
      cache.set(
        cacheKey,
        null,
      );

      return null;
    }

    const search =
      (
        await searchResponse.json()
      ) as SearchResponse;

    const ids =
      (
        search.search ??
        []
      )
        .map(
          (
            item,
          ) =>
            item.id,
        )
        .filter(
          Boolean,
        );

    if (
      ids.length ===
      0
    ) {
      cache.set(
        cacheKey,
        null,
      );

      return null;
    }

    /*
    |--------------------------------------------------------------------------
    | Candidate entities
    |--------------------------------------------------------------------------
    */

    const entities =
      await getEntities(
        ids,
        true,
      );

    const dobMatches =
      ids
        .map(
          (
            id,
          ) =>
            entities[id],
        )
        .filter(
          (
            entity,
          ): entity is Entity =>
            Boolean(
              entity,
            ),
        )
        .filter(
          (
            entity,
          ) =>
            claimTime(
              entity,
              "P569",
            ) ===
            date,
        );

    if (
      dobMatches.length ===
      0
    ) {
      cache.set(
        cacheKey,
        null,
      );

      return null;
    }

    /*
     * DOB is the hard identity check.
     * If multiple entities somehow share it,
     * prefer the best normalized-name match.
     */

    const normalizedName =
      normalizedPersonName(
        name,
      );

    const entity =
      dobMatches.find(
        (
          candidate,
        ) => {
          const label =
            candidate.labels
              ?.en
              ?.value;

          if (!label) {
            return false;
          }

          return (
            normalizedPersonName(
              label,
            ) ===
            normalizedName
          );
        },
      ) ??
      (
        dobMatches.length ===
        1
          ? dobMatches[0]
          : null
      );

    if (
      !entity ||
      !entity.id
    ) {
      cache.set(
        cacheKey,
        null,
      );

      return null;
    }

    /*
    |--------------------------------------------------------------------------
    | Preferred foot
    |--------------------------------------------------------------------------
    */

    const footId =
      claimEntityId(
        entity,
        "P8006",
      );

    const preferredFoot =
      footId ===
      LEFT_FOOTED
        ? "left"
        : footId ===
            RIGHT_FOOTED
          ? "right"
          : footId ===
              BOTH_FOOTED
            ? "both"
            : null;

    /*
    |--------------------------------------------------------------------------
    | Citizenship / nationality
    |--------------------------------------------------------------------------
    */

    const countryId =
      claimEntityId(
        entity,
        "P27",
      );

    let nationality:
      string | null =
      null;

    if (countryId) {
      const countryEntities =
        await getEntities(
          [
            countryId,
          ],
          false,
        );

      nationality =
        countryEntities[
          countryId
        ]?.labels
          ?.en
          ?.value ??
        null;
    }

    const result = {
      entityId:
        entity.id,

      nationality,

      preferredFoot,
    } satisfies WikidataPlayerMetadata;

    cache.set(
      cacheKey,
      result,
    );

    return result;
  } catch (
    error
  ) {
    console.warn(
      `Wikidata metadata lookup failed for ${name}:`,
      error,
    );

    cache.set(
      cacheKey,
      null,
    );

    return null;
  }
}

async function getEntities(
  ids:
    string[],

  includeClaims:
    boolean,
) {
  const url =
    new URL(
      "https://www.wikidata.org/w/api.php",
    );

  url.search =
    new URLSearchParams({
      action:
        "wbgetentities",

      ids:
        ids.join(
          "|",
        ),

      props:
        includeClaims
          ? "claims|labels"
          : "labels",

      languages:
        "en",

      format:
        "json",

      origin:
        "*",
    }).toString();

  const response =
    await fetch(
      url,
      {
        headers: {
          "User-Agent":
            "barca-dashboard/0.1 personal-project",
        },

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    return {};
  }

  const payload =
    (
      await response.json()
    ) as EntityResponse;

  return (
    payload.entities ??
    {}
  );
}

function claimEntityId(
  entity:
    Entity,

  property:
    string,
) {
  const claims =
    entity.claims?.[
      property
    ] ??
    [];

  for (
    const claim
    of claims
  ) {
    const value =
      claim.mainsnak
        ?.datavalue
        ?.value;

    if (
      value &&
      typeof value ===
        "object" &&
      "id" in
        value
    ) {
      const id =
        (
          value as {
            id?:
              unknown;
          }
        ).id;

      if (
        typeof id ===
        "string"
      ) {
        return id;
      }
    }
  }

  return null;
}

function claimTime(
  entity:
    Entity,

  property:
    string,
) {
  const claims =
    entity.claims?.[
      property
    ] ??
    [];

  for (
    const claim
    of claims
  ) {
    const value =
      claim.mainsnak
        ?.datavalue
        ?.value;

    if (
      value &&
      typeof value ===
        "object" &&
      "time" in
        value
    ) {
      const time =
        (
          value as {
            time?:
              unknown;
          }
        ).time;

      if (
        typeof time ===
        "string"
      ) {
        return dateKey(
          time,
        );
      }
    }
  }

  return null;
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