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
   * Official FC Barcelona first-team
   * portrait.
   *
   * For the verified season roster this
   * is our preferred portrait source.
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
| SquadMembership represents the real first-team roster.
|
| Official FC Barcelona player portraits are also stored here so the whole
| squad uses one consistent visual source.
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
        /*
        |--------------------------------------------------------------------------
        | Goalkeepers
        |--------------------------------------------------------------------------
        */

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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/5d0c5826-9ec5-4625-a97b-3b8d0ca98418/01-Joan_Garcia.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/52a7bf3e-6f10-4319-b820-ed0f38e7afa1/25-Szczesny.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/08/26/f1059387-7c3e-434a-8854-8f9a8d29b4f7/Livakovic-.png?height=790&width=670",
        },

        /*
        |--------------------------------------------------------------------------
        | Defenders
        |--------------------------------------------------------------------------
        */

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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/08/19/7d3f20c8-d349-42e6-90a5-d70a6a2f86b7/00-Cancelo.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/e6ad1688-d559-4991-a2a0-3c7fbfd1b14f/03-Balde.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/a321161c-87a5-4d8d-b05e-b547e0080e98/02-Cubarsi.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/08/26/d83f3960-8967-4b02-9f2c-363fc34fd2f7/12-XAVI_ESPART-TRANSP.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/6e0054f3-5ae7-4b3a-a92c-af81cee28235/15-Christensen.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/04d96175-c81e-4fd4-9743-34d4532e1a70/18-Martin.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/6e0885df-ddcc-44c7-b55f-a421606004c0/23-Kounde.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/cf862ceb-2d47-4489-8db6-e65d770443ad/24-Eric_Garcia.png?height=790&width=670",
        },

        /*
        |--------------------------------------------------------------------------
        | Midfielders
        |--------------------------------------------------------------------------
        */

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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/09/03/b05e6b1b-fe32-4420-b981-36507d7dfeb0/04-Brian_Farinas.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/816698d5-5eb4-4947-bcdb-a3771ce71398/06-Gavi.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/2d251fe0-dd9c-45cf-9789-125254d39a65/16-Fermin.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/02b47c57-d919-47b7-8e39-d744c58c68dd/08-Pedri.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/08/18/e8a9d0db-9e45-4f40-8db5-c91530aefc21/00-Rodri.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/d0846fb5-c160-474f-a5ea-b5c404e9c5cd/20-Olmo.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/72069942-2745-42e2-85a5-3e85004443ca/22-Bernal.png?height=790&width=670",
        },

        /*
        |--------------------------------------------------------------------------
        | Forwards
        |--------------------------------------------------------------------------
        */

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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/09/03/f8d954d8-3841-490c-9db0-1614995ec68d/09-Gabriel_Jesus.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/d8c055dc-f43e-4125-9789-34c86fb99a1c/10-Lamine.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/799c94b4-fa33-4472-bb6b-4b537baf219c/11-Raphinha.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/24/545eed77-cb8c-48f7-a762-f9d459c45bf5/00-Adeyemi.png?height=790&width=670",
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

          portraitUrl:
            "https://www.fcbarcelona.com/photo-resources/2026/07/21/8dfb11f8-dbb7-46e8-ab7e-4bb47f44d05e/00-Gordon.png?height=790&width=670",
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