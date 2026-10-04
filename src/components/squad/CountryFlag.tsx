"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  nationalityDisplay,
} from "../../lib/countries";

type CountryFlagProps = {
  nationality:
    string | null;

  size?:
    "small"
    | "normal";
};

/*
|--------------------------------------------------------------------------
| Provider / country fallbacks
|--------------------------------------------------------------------------
|
| nationalityDisplay remains the canonical formatter.
|
| This fallback handles cases where providers give:
|
| Egypt
| Egyptian
| EGY
| Netherlands
| Dutch
| etc.
|
| The important part for flags is ultimately getting a reliable ISO-2 code.
|--------------------------------------------------------------------------
*/

const ALPHA3_TO_ALPHA2:
  Record<
    string,
    string
  > = {
    ARG:
      "AR",

    AUT:
      "AT",

    BEL:
      "BE",

    BRA:
      "BR",

    COL:
      "CO",

    CRO:
      "HR",

    DEN:
      "DK",

    ECU:
      "EC",

    EGY:
      "EG",

    ENG:
      "GB",

    ESP:
      "ES",

    FRA:
      "FR",

    GER:
      "DE",

    GHA:
      "GH",

    MAR:
      "MA",

    NED:
      "NL",

    NLD:
      "NL",

    POL:
      "PL",

    POR:
      "PT",

    SEN:
      "SN",

    SWE:
      "SE",

    TUR:
      "TR",

    URU:
      "UY",

    USA:
      "US",
  };

const NATIONALITY_TO_ALPHA2:
  Record<
    string,
    string
  > = {
    argentina:
      "AR",

    argentine:
      "AR",

    argentinian:
      "AR",

    austria:
      "AT",

    austrian:
      "AT",

    belgium:
      "BE",

    belgian:
      "BE",

    brazil:
      "BR",

    brazilian:
      "BR",

    colombia:
      "CO",

    colombian:
      "CO",

    croatia:
      "HR",

    croatian:
      "HR",

    denmark:
      "DK",

    danish:
      "DK",

    ecuador:
      "EC",

    ecuadorian:
      "EC",

    egypt:
      "EG",

    egyptian:
      "EG",

    england:
      "GB",

    english:
      "GB",

    france:
      "FR",

    french:
      "FR",

    germany:
      "DE",

    german:
      "DE",

    ghana:
      "GH",

    ghanaian:
      "GH",

    morocco:
      "MA",

    moroccan:
      "MA",

    netherlands:
      "NL",

    dutch:
      "NL",

    poland:
      "PL",

    polish:
      "PL",

    portugal:
      "PT",

    portuguese:
      "PT",

    senegal:
      "SN",

    senegalese:
      "SN",

    spain:
      "ES",

    spanish:
      "ES",

    sweden:
      "SE",

    swedish:
      "SE",

    turkey:
      "TR",

    turkiye:
      "TR",

    turkish:
      "TR",

    uruguay:
      "UY",

    uruguayan:
      "UY",

    "united states":
      "US",

    "united states of america":
      "US",

    american:
      "US",

    usa:
      "US",
  };

export default function CountryFlag({
  nationality,
  size =
    "normal",
}: CountryFlagProps) {
  const [
    imageFailed,
    setImageFailed,
  ] =
    useState(
      false,
    );

  const country =
    nationalityDisplay(
      nationality,
    );

  const code =
    useMemo(
      () =>
        resolveCountryCode({
          nationality,

          displayCode:
            country?.code ??
            null,

          displayName:
            country?.name ??
            null,
        }),
      [
        country?.code,
        country?.name,
        nationality,
      ],
    );

  const displayName =
    country?.name ??
    humanizeNationality(
      nationality,
    ) ??
    "Unknown";

  const dimensions =
    size ===
    "small"
      ? {
          width:
            18,

          height:
            12,
        }
      : {
          width:
            22,

          height:
            15,
        };

  const flagUrl =
    code
      ? `https://flagcdn.com/w40/${code.toLowerCase()}.png`
      : null;

  return (
    <span
      className="
        inline-flex
        items-center
        gap-2
      "
    >
      {flagUrl &&
      !imageFailed ? (
        <span
          className="
            flex
            shrink-0
            overflow-hidden
            border
          "
          style={{
            width:
              dimensions.width,

            height:
              dimensions.height,

            borderColor:
              "rgba(255,255,255,0.13)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              flagUrl
            }
            alt={`${displayName} flag`}
            width={
              dimensions.width
            }
            height={
              dimensions.height
            }
            loading="lazy"
            className="
              h-full
              w-full
              object-cover
            "
            onError={
              () =>
                setImageFailed(
                  true,
                )
            }
          />
        </span>
      ) : code ? (
        <span
          className="
            inline-flex
            min-w-6
            items-center
            justify-center
            border
            px-1
            text-[7px]
            font-semibold
          "
        >
          {code}
        </span>
      ) : null}

      <span>
        {displayName}
      </span>
    </span>
  );
}

function resolveCountryCode({
  nationality,
  displayCode,
  displayName,
}: {
  nationality:
    string | null;

  displayCode:
    string | null;

  displayName:
    string | null;
}) {
  /*
  |--------------------------------------------------------------------------
  | Canonical display code
  |--------------------------------------------------------------------------
  */

  if (displayCode) {
    const normalized =
      displayCode
        .trim()
        .toUpperCase();

    if (
      normalized.length ===
      2
    ) {
      return normalized;
    }

    if (
      normalized.length ===
        3 &&
      ALPHA3_TO_ALPHA2[
        normalized
      ]
    ) {
      return (
        ALPHA3_TO_ALPHA2[
          normalized
        ]
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Canonical display name
  |--------------------------------------------------------------------------
  */

  if (displayName) {
    const normalized =
      normalizeCountryText(
        displayName,
      );

    const code =
      NATIONALITY_TO_ALPHA2[
        normalized
      ];

    if (code) {
      return code;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Raw provider nationality
  |--------------------------------------------------------------------------
  */

  if (nationality) {
    const trimmed =
      nationality.trim();

    const upper =
      trimmed.toUpperCase();

    if (
      upper.length ===
      2
    ) {
      return upper;
    }

    if (
      upper.length ===
        3 &&
      ALPHA3_TO_ALPHA2[
        upper
      ]
    ) {
      return (
        ALPHA3_TO_ALPHA2[
          upper
        ]
      );
    }

    const normalized =
      normalizeCountryText(
        trimmed,
      );

    return (
      NATIONALITY_TO_ALPHA2[
        normalized
      ] ??
      null
    );
  }

  return null;
}

function normalizeCountryText(
  value:
    string,
) {
  return value
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-zA-Z ]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .toLowerCase();
}

function humanizeNationality(
  value:
    string | null,
) {
  if (!value) {
    return null;
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}