export type OfficialSquadPosition =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward";

export type OfficialPreferredFoot =
  | "left"
  | "right"
  | "both";

export type OfficialSquadPlayer = {
  displayName:
    string;

  aliases:
    string[];

  birthDate:
    string;

  nationality:
    string;

  shirtNumber:
    number;

  position:
    OfficialSquadPosition;

  preferredFoot:
    OfficialPreferredFoot;

  /*
   * Optional verified portrait fallback.
   *
   * Normal provider portraits remain the
   * default source. This is only used when
   * providers do not give us a portrait.
   */
  portraitUrl?:
    string;
};

export type OfficialSquadManifest = {
  season:
    string;

  verifiedAt:
    string;

  players:
    OfficialSquadPlayer[];
};

/*
|--------------------------------------------------------------------------
| Verified first-team squad manifests
|--------------------------------------------------------------------------
|
| SquadMembership must represent the actual season first-team squad.
|
| A player appearing in a match lineup does NOT automatically make them a
| permanent first-team squad member.
|--------------------------------------------------------------------------
*/

const OFFICIAL_SQUAD_MANIFESTS:
  Record<
    string,
    OfficialSquadManifest
  > = {
    "2026/27": {
      season:
        "2026/27",

      verifiedAt:
        "2026-09-02T00:00:00Z",

      players: [
        {
          displayName:
            "Joan García",

          aliases: [
            "Joan García",
            "Joan Garcia",
          ],

          birthDate:
            "2001-05-04",

          nationality:
            "Spain",

          shirtNumber:
            1,

          position:
            "goalkeeper",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "João Cancelo",

          aliases: [
            "João Cancelo",
            "Joao Cancelo",
            "João Pedro Cavaco Cancelo",
          ],

          birthDate:
            "1994-05-27",

          nationality:
            "Portugal",

          shirtNumber:
            2,

          position:
            "defender",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Alejandro Balde",

          aliases: [
            "Alejandro Balde",
            "Alejandro Balde Martínez",
          ],

          birthDate:
            "2003-10-18",

          nationality:
            "Spain",

          shirtNumber:
            3,

          position:
            "defender",

          preferredFoot:
            "left",
        },

        {
          displayName:
            "Brian Fariñas",

          aliases: [
            "Brian Fariñas",
            "Brian Farinas",
          ],

          birthDate:
            "2006-02-09",

          nationality:
            "Spain",

          shirtNumber:
            4,

          position:
            "midfielder",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Pau Cubarsí",

          aliases: [
            "Pau Cubarsí",
            "Pau Cubarsi",
            "Pau Cubarsí Paredes",
          ],

          birthDate:
            "2007-01-22",

          nationality:
            "Spain",

          shirtNumber:
            5,

          position:
            "defender",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Gavi",

          aliases: [
            "Gavi",
            "Pablo Martín Páez Gavira",
            "Pablo Martin Paez Gavira",
          ],

          birthDate:
            "2004-08-05",

          nationality:
            "Spain",

          shirtNumber:
            6,

          position:
            "midfielder",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Fermín López",

          aliases: [
            "Fermín López",
            "Fermin Lopez",
            "Fermín López Marín",
          ],

          birthDate:
            "2003-05-11",

          nationality:
            "Spain",

          shirtNumber:
            7,

          position:
            "midfielder",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Pedri",

          aliases: [
            "Pedri",
            "Pedro González",
            "Pedro Gonzalez",
            "Pedro González López",
            "Pedro Gonzalez Lopez",
          ],

          birthDate:
            "2002-11-25",

          nationality:
            "Spain",

          shirtNumber:
            8,

          position:
            "midfielder",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Gabriel Jesus",

          aliases: [
            "Gabriel Jesus",
            "Gabriel Fernando de Jesus",
          ],

          birthDate:
            "1997-04-03",

          nationality:
            "Brazil",

          shirtNumber:
            9,

          position:
            "forward",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Lamine Yamal",

          aliases: [
            "Lamine Yamal",
            "Lamine Yamal Nasraoui Ebana",
          ],

          birthDate:
            "2007-07-13",

          nationality:
            "Spain",

          shirtNumber:
            10,

          position:
            "forward",

          preferredFoot:
            "left",
        },

        {
          displayName:
            "Raphinha",

          aliases: [
            "Raphinha",
            "Raphael Dias Belloli",
            "Raphael Dias",
          ],

          birthDate:
            "1996-12-14",

          nationality:
            "Brazil",

          shirtNumber:
            11,

          position:
            "forward",

          preferredFoot:
            "left",
        },

        {
          displayName:
            "Xavi Espart",

          aliases: [
            "Xavi Espart",
            "Xavi Espart Font",
          ],

          birthDate:
            "2007-05-21",

          nationality:
            "Spain",

          shirtNumber:
            12,

          position:
            "defender",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Wojciech Szczęsny",

          aliases: [
            "Wojciech Szczęsny",
            "Wojciech Szczesny",
            "Szczęsny",
            "Szczesny",
          ],

          birthDate:
            "1990-04-18",

          nationality:
            "Poland",

          shirtNumber:
            13,

          position:
            "goalkeeper",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Karim Adeyemi",

          aliases: [
            "Karim Adeyemi",
            "Karim-David Adeyemi",
          ],

          birthDate:
            "2002-01-18",

          nationality:
            "Germany",

          shirtNumber:
            14,

          position:
            "forward",

          preferredFoot:
            "left",
        },

        {
          displayName:
            "Andreas Christensen",

          aliases: [
            "Andreas Christensen",
            "Andreas Bødtker Christensen",
          ],

          birthDate:
            "1996-04-10",

          nationality:
            "Denmark",

          shirtNumber:
            15,

          position:
            "defender",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Rodri",

          aliases: [
            "Rodri",
            "Rodrigo",
            "Rodrigo Hernández",
            "Rodrigo Hernandez",
            "Rodrigo Hernández Cascante",
            "Rodrigo Hernandez Cascante",
          ],

          birthDate:
            "1996-06-22",

          nationality:
            "Spain",

          shirtNumber:
            16,

          position:
            "midfielder",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Anthony Gordon",

          aliases: [
            "Anthony Gordon",
            "Anthony Michael Gordon",
          ],

          birthDate:
            "2001-02-24",

          nationality:
            "England",

          shirtNumber:
            17,

          position:
            "forward",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Gerard Martín",

          aliases: [
            "Gerard Martín",
            "Gerard Martin",
          ],

          birthDate:
            "2002-02-26",

          nationality:
            "Spain",

          shirtNumber:
            18,

          position:
            "defender",

          preferredFoot:
            "left",
        },

        {
          displayName:
            "Roony Bardghji",

          aliases: [
            "Roony Bardghji",
            "Roony",
          ],

          birthDate:
            "2005-11-15",

          nationality:
            "Sweden",

          shirtNumber:
            19,

          position:
            "forward",

          preferredFoot:
            "left",

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/279612fb-8157-4cc6-8cf9-b2bff451487f/28-Bardghji.png?height=790&width=670",
        },

        {
          displayName:
            "Dani Olmo",

          aliases: [
            "Dani Olmo",
            "Daniel Olmo",
            "Daniel Olmo Carvajal",
          ],

          birthDate:
            "1998-05-07",

          nationality:
            "Spain",

          shirtNumber:
            20,

          position:
            "midfielder",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Frenkie de Jong",

          aliases: [
            "Frenkie de Jong",
            "Frenkie",
            "De Jong",
          ],

          birthDate:
            "1997-05-12",

          nationality:
            "Netherlands",

          shirtNumber:
            21,

          position:
            "midfielder",

          preferredFoot:
            "right",

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/3aefde9a-9253-46c3-a88a-c4cb647a4869/21-De_Jong.png?height=790&width=670",
        },

        {
          displayName:
            "Marc Bernal",

          aliases: [
            "Marc Bernal",
            "Marc Bernal Casas",
          ],

          birthDate:
            "2007-05-26",

          nationality:
            "Spain",

          shirtNumber:
            22,

          position:
            "midfielder",

          preferredFoot:
            "left",
        },

        {
          displayName:
            "Jules Koundé",

          aliases: [
            "Jules Koundé",
            "Jules Kounde",
            "Jules Olivier Koundé",
          ],

          birthDate:
            "1998-11-12",

          nationality:
            "France",

          shirtNumber:
            23,

          position:
            "defender",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Eric García",

          aliases: [
            "Eric García",
            "Eric Garcia",
            "Eric García Martret",
            "Eric Garcia Martret",
          ],

          birthDate:
            "2001-01-09",

          nationality:
            "Spain",

          shirtNumber:
            24,

          position:
            "defender",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Dominik Livaković",

          aliases: [
            "Dominik Livaković",
            "Dominik Livakovic",
          ],

          birthDate:
            "1995-01-09",

          nationality:
            "Croatia",

          shirtNumber:
            25,

          position:
            "goalkeeper",

          preferredFoot:
            "right",
        },

        {
          displayName:
            "Jesse Bisiwu",

          aliases: [
            "Jesse Bisiwu",
            "Bisiwu",
          ],

          birthDate:
            "2008-01-22",

          nationality:
            "Belgium",

          shirtNumber:
            27,

          position:
            "forward",

          preferredFoot:
            "right",

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/08/04/429f1091-2f0e-415f-a74d-bfc33bfce28c/00-Bisiwu.png?height=790&width=670",
        },

        {
          displayName:
            "Hamza Abdelkarim",

          aliases: [
            "Hamza Abdelkarim",
            "Hamza Mohamed Abdelkarim Elsayed Selim",
            "Hamza Mohamed Abdelkarim Selim",
          ],

          birthDate:
            "2008-01-01",

          nationality:
            "Egypt",

          shirtNumber:
            29,

          position:
            "forward",

          preferredFoot:
            "both",

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/09/03/2ae7b4d7-4a07-4598-ae71-aaa1f7c4f871/29-Hamza.png?height=790&width=670",
        },
      ],
    },
  };

/*
|--------------------------------------------------------------------------
| Public accessor
|--------------------------------------------------------------------------
*/

export function getOfficialSquadManifest(
  seasonLabel:
    string,
) {
  return (
    OFFICIAL_SQUAD_MANIFESTS[
      seasonLabel
    ] ??
    null
  );
}