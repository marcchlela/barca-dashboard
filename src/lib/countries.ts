export type NationalityDisplay = {
  name:
    string;

  code:
    string | null;

  flag:
    string | null;

  text:
    string;
};

type CountryDefinition = {
  name:
    string;

  code:
    string;
};

const COUNTRIES:
  Record<
    string,
    CountryDefinition
  > = {
    /*
    |--------------------------------------------------------------------------
    | Spain
    |--------------------------------------------------------------------------
    */

    spain: {
      name:
        "Spain",
      code:
        "ES",
    },

    spanish: {
      name:
        "Spain",
      code:
        "ES",
    },

    esp: {
      name:
        "Spain",
      code:
        "ES",
    },

    es: {
      name:
        "Spain",
      code:
        "ES",
    },

    /*
    |--------------------------------------------------------------------------
    | Germany
    |--------------------------------------------------------------------------
    */

    germany: {
      name:
        "Germany",
      code:
        "DE",
    },

    german: {
      name:
        "Germany",
      code:
        "DE",
    },

    deu: {
      name:
        "Germany",
      code:
        "DE",
    },

    ger: {
      name:
        "Germany",
      code:
        "DE",
    },

    /*
    |--------------------------------------------------------------------------
    | Poland
    |--------------------------------------------------------------------------
    */

    poland: {
      name:
        "Poland",
      code:
        "PL",
    },

    polish: {
      name:
        "Poland",
      code:
        "PL",
    },

    pol: {
      name:
        "Poland",
      code:
        "PL",
    },

    /*
    |--------------------------------------------------------------------------
    | Brazil
    |--------------------------------------------------------------------------
    */

    brazil: {
      name:
        "Brazil",
      code:
        "BR",
    },

    brazilian: {
      name:
        "Brazil",
      code:
        "BR",
    },

    bra: {
      name:
        "Brazil",
      code:
        "BR",
    },

    /*
    |--------------------------------------------------------------------------
    | Uruguay
    |--------------------------------------------------------------------------
    */

    uruguay: {
      name:
        "Uruguay",
      code:
        "UY",
    },

    uruguayan: {
      name:
        "Uruguay",
      code:
        "UY",
    },

    uru: {
      name:
        "Uruguay",
      code:
        "UY",
    },

    /*
    |--------------------------------------------------------------------------
    | France
    |--------------------------------------------------------------------------
    */

    france: {
      name:
        "France",
      code:
        "FR",
    },

    french: {
      name:
        "France",
      code:
        "FR",
    },

    fra: {
      name:
        "France",
      code:
        "FR",
    },

    /*
    |--------------------------------------------------------------------------
    | Netherlands
    |--------------------------------------------------------------------------
    */

    netherlands: {
      name:
        "Netherlands",
      code:
        "NL",
    },

    holland: {
      name:
        "Netherlands",
      code:
        "NL",
    },

    dutch: {
      name:
        "Netherlands",
      code:
        "NL",
    },

    nld: {
      name:
        "Netherlands",
      code:
        "NL",
    },

    ned: {
      name:
        "Netherlands",
      code:
        "NL",
    },

    /*
    |--------------------------------------------------------------------------
    | Denmark
    |--------------------------------------------------------------------------
    */

    denmark: {
      name:
        "Denmark",
      code:
        "DK",
    },

    danish: {
      name:
        "Denmark",
      code:
        "DK",
    },

    dnk: {
      name:
        "Denmark",
      code:
        "DK",
    },

    den: {
      name:
        "Denmark",
      code:
        "DK",
    },

    /*
    |--------------------------------------------------------------------------
    | Sweden
    |--------------------------------------------------------------------------
    */

    sweden: {
      name:
        "Sweden",
      code:
        "SE",
    },

    swedish: {
      name:
        "Sweden",
      code:
        "SE",
    },

    swe: {
      name:
        "Sweden",
      code:
        "SE",
    },

    /*
    |--------------------------------------------------------------------------
    | Portugal
    |--------------------------------------------------------------------------
    */

    portugal: {
      name:
        "Portugal",
      code:
        "PT",
    },

    portuguese: {
      name:
        "Portugal",
      code:
        "PT",
    },

    prt: {
      name:
        "Portugal",
      code:
        "PT",
    },

    por: {
      name:
        "Portugal",
      code:
        "PT",
    },

    /*
    |--------------------------------------------------------------------------
    | Argentina
    |--------------------------------------------------------------------------
    */

    argentina: {
      name:
        "Argentina",
      code:
        "AR",
    },

    argentine: {
      name:
        "Argentina",
      code:
        "AR",
    },

    argentinian: {
      name:
        "Argentina",
      code:
        "AR",
    },

    arg: {
      name:
        "Argentina",
      code:
        "AR",
    },

    /*
    |--------------------------------------------------------------------------
    | Belgium
    |--------------------------------------------------------------------------
    */

    belgium: {
      name:
        "Belgium",
      code:
        "BE",
    },

    belgian: {
      name:
        "Belgium",
      code:
        "BE",
    },

    bel: {
      name:
        "Belgium",
      code:
        "BE",
    },

    /*
    |--------------------------------------------------------------------------
    | Croatia
    |--------------------------------------------------------------------------
    */

    croatia: {
      name:
        "Croatia",
      code:
        "HR",
    },

    croatian: {
      name:
        "Croatia",
      code:
        "HR",
    },

    hrv: {
      name:
        "Croatia",
      code:
        "HR",
    },

    cro: {
      name:
        "Croatia",
      code:
        "HR",
    },

    /*
|--------------------------------------------------------------------------
| Egypt
|--------------------------------------------------------------------------
*/

egypt: {
  name:
    "Egypt",
  code:
    "EG",
},

egyptian: {
  name:
    "Egypt",
  code:
    "EG",
},

egy: {
  name:
    "Egypt",
  code:
    "EG",
},

eg: {
  name:
    "Egypt",
  code:
    "EG",
},

    /*
    |--------------------------------------------------------------------------
    | Morocco
    |--------------------------------------------------------------------------
    */

    morocco: {
      name:
        "Morocco",
      code:
        "MA",
    },

    moroccan: {
      name:
        "Morocco",
      code:
        "MA",
    },

    mar: {
      name:
        "Morocco",
      code:
        "MA",
    },

    /*
    |--------------------------------------------------------------------------
    | Senegal
    |--------------------------------------------------------------------------
    */

    senegal: {
      name:
        "Senegal",
      code:
        "SN",
    },

    senegalese: {
      name:
        "Senegal",
      code:
        "SN",
    },

    sen: {
      name:
        "Senegal",
      code:
        "SN",
    },

    /*
    |--------------------------------------------------------------------------
    | Serbia
    |--------------------------------------------------------------------------
    */

    serbia: {
      name:
        "Serbia",
      code:
        "RS",
    },

    serbian: {
      name:
        "Serbia",
      code:
        "RS",
    },

    srb: {
      name:
        "Serbia",
      code:
        "RS",
    },

    /*
    |--------------------------------------------------------------------------
    | Austria
    |--------------------------------------------------------------------------
    */

    austria: {
      name:
        "Austria",
      code:
        "AT",
    },

    austrian: {
      name:
        "Austria",
      code:
        "AT",
    },

    aut: {
      name:
        "Austria",
      code:
        "AT",
    },

    /*
    |--------------------------------------------------------------------------
    | Switzerland
    |--------------------------------------------------------------------------
    */

    switzerland: {
      name:
        "Switzerland",
      code:
        "CH",
    },

    swiss: {
      name:
        "Switzerland",
      code:
        "CH",
    },

    che: {
      name:
        "Switzerland",
      code:
        "CH",
    },

    sui: {
      name:
        "Switzerland",
      code:
        "CH",
    },

    /*
    |--------------------------------------------------------------------------
    | Italy
    |--------------------------------------------------------------------------
    */

    italy: {
      name:
        "Italy",
      code:
        "IT",
    },

    italian: {
      name:
        "Italy",
      code:
        "IT",
    },

    ita: {
      name:
        "Italy",
      code:
        "IT",
    },

    /*
    |--------------------------------------------------------------------------
    | Turkey
    |--------------------------------------------------------------------------
    */

    turkey: {
      name:
        "Turkey",
      code:
        "TR",
    },

    turkiye: {
      name:
        "Turkey",
      code:
        "TR",
    },

    turkish: {
      name:
        "Turkey",
      code:
        "TR",
    },

    tur: {
      name:
        "Turkey",
      code:
        "TR",
    },

    /*
    |--------------------------------------------------------------------------
    | USA
    |--------------------------------------------------------------------------
    */

    usa: {
      name:
        "United States",
      code:
        "US",
    },

    us: {
      name:
        "United States",
      code:
        "US",
    },

    unitedstates: {
      name:
        "United States",
      code:
        "US",
    },

    unitedstatesofamerica: {
      name:
        "United States",
      code:
        "US",
    },

    american: {
      name:
        "United States",
      code:
        "US",
    },

    /*
    |--------------------------------------------------------------------------
    | Mexico
    |--------------------------------------------------------------------------
    */

    mexico: {
      name:
        "Mexico",
      code:
        "MX",
    },

    mexican: {
      name:
        "Mexico",
      code:
        "MX",
    },

    mex: {
      name:
        "Mexico",
      code:
        "MX",
    },

    /*
    |--------------------------------------------------------------------------
    | Colombia
    |--------------------------------------------------------------------------
    */

    colombia: {
      name:
        "Colombia",
      code:
        "CO",
    },

    colombian: {
      name:
        "Colombia",
      code:
        "CO",
    },

    col: {
      name:
        "Colombia",
      code:
        "CO",
    },

    /*
    |--------------------------------------------------------------------------
    | Ecuador
    |--------------------------------------------------------------------------
    */

    ecuador: {
      name:
        "Ecuador",
      code:
        "EC",
    },

    ecuadorian: {
      name:
        "Ecuador",
      code:
        "EC",
    },

    ecu: {
      name:
        "Ecuador",
      code:
        "EC",
    },

    /*
    |--------------------------------------------------------------------------
    | Chile
    |--------------------------------------------------------------------------
    */

    chile: {
      name:
        "Chile",
      code:
        "CL",
    },

    chilean: {
      name:
        "Chile",
      code:
        "CL",
    },

    chl: {
      name:
        "Chile",
      code:
        "CL",
    },

    /*
    |--------------------------------------------------------------------------
    | England / UK
    |--------------------------------------------------------------------------
    */

    england: {
      name:
        "England",
      code:
        "GB",
    },

    english: {
      name:
        "England",
      code:
        "GB",
    },

    eng: {
      name:
        "England",
      code:
        "GB",
    },

    unitedkingdom: {
      name:
        "United Kingdom",
      code:
        "GB",
    },

    british: {
      name:
        "United Kingdom",
      code:
        "GB",
    },

    gbr: {
      name:
        "United Kingdom",
      code:
        "GB",
    },

    uk: {
      name:
        "United Kingdom",
      code:
        "GB",
    },

    /*
    |--------------------------------------------------------------------------
    | Greece
    |--------------------------------------------------------------------------
    */

    greece: {
      name:
        "Greece",
      code:
        "GR",
    },

    greek: {
      name:
        "Greece",
      code:
        "GR",
    },

    grc: {
      name:
        "Greece",
      code:
        "GR",
    },

    /*
    |--------------------------------------------------------------------------
    | Slovenia
    |--------------------------------------------------------------------------
    */

    slovenia: {
      name:
        "Slovenia",
      code:
        "SI",
    },

    slovenian: {
      name:
        "Slovenia",
      code:
        "SI",
    },

    svn: {
      name:
        "Slovenia",
      code:
        "SI",
    },

    /*
    |--------------------------------------------------------------------------
    | Czechia
    |--------------------------------------------------------------------------
    */

    czechia: {
      name:
        "Czechia",
      code:
        "CZ",
    },

    czechrepublic: {
      name:
        "Czechia",
      code:
        "CZ",
    },

    czech: {
      name:
        "Czechia",
      code:
        "CZ",
    },

    cze: {
      name:
        "Czechia",
      code:
        "CZ",
    },

    /*
    |--------------------------------------------------------------------------
    | Ivory Coast
    |--------------------------------------------------------------------------
    */

    cotedivoire: {
      name:
        "Côte d'Ivoire",
      code:
        "CI",
    },

    ivorycoast: {
      name:
        "Côte d'Ivoire",
      code:
        "CI",
    },

    civ: {
      name:
        "Côte d'Ivoire",
      code:
        "CI",
    },
  };

function nationalityKey(
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
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      "",
    );
}

function flagEmoji(
  code:
    string,
) {
  if (
    !/^[A-Z]{2}$/.test(
      code,
    )
  ) {
    return null;
  }

  return Array.from(
    code,
  )
    .map(
      (
        letter,
      ) =>
        String.fromCodePoint(
          127397 +
            letter.charCodeAt(
              0,
            ),
        ),
    )
    .join(
      "",
    );
}

export function nationalityDisplay(
  value:
    string | null | undefined,
): NationalityDisplay | null {
  if (
    !value ||
    !value.trim()
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  const definition =
    COUNTRIES[
      nationalityKey(
        trimmed,
      )
    ];

  if (!definition) {
    return {
      name:
        trimmed,

      code:
        null,

      flag:
        null,

      text:
        trimmed,
    };
  }

  const flag =
    flagEmoji(
      definition.code,
    );

  return {
    name:
      definition.name,

    code:
      definition.code,

    flag,

    text:
      flag
        ? `${definition.name} ${flag}`
        : definition.name,
  };
}

export function normalizeNationalityName(
  value:
    string | null | undefined,
) {
  return (
    nationalityDisplay(
      value,
    )?.name ??
    null
  );
}