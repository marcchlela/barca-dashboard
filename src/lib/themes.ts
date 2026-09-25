export type KitType =
  | "home"
  | "away"
  | "third";

export type KitTheme = {
  id: KitType;
  label: string;

  colors: {
    background: string;
    backgroundElevated: string;
    surface: string;

    border: string;

    text: string;
    textMuted: string;

    primary: string;
    secondary: string;
    accent: string;

    pitchLine: string;

    success: string;
    danger: string;
    warning: string;
  };
};

/*
|--------------------------------------------------------------------------
| FC Barcelona kit themes
|--------------------------------------------------------------------------
|
| The kit palette drives the theme,
| but the UI does NOT need to literally
| paint the entire screen in the jersey color.
|
| Home:
|   Barça red   #6B1D2F
|   Barça blue  #0B1A30
|   Gold        #D39C43
|
| Away:
|   Purple      #4D2280
|   Black
|   Gold        #C5A059
|
| Third:
|   Mint        #A6E7D2
|   Teal        #00A3A6
|   Gym Red
|   Loyal Blue
|--------------------------------------------------------------------------
*/

const homeTheme: KitTheme = {
  id: "home",

  label: "Home",

  colors: {
    /*
     * Dark Barça-blue environment.
     */

    background:
      "#07111F",

    backgroundElevated:
      "#091728",

    surface:
      "#0D1B2E",

    border:
      "#23344D",

    text:
      "#F2F3F5",

    textMuted:
      "#8D9AAF",

    /*
     * Confirmed kit colors.
     */

    primary:
      "#6B1D2F",

    secondary:
      "#0B1A30",

    accent:
      "#D39C43",

    pitchLine:
      "#35506D",

    success:
      "#55C995",

    danger:
      "#D75B70",

    warning:
      "#D39C43",
  },
};

const awayTheme: KitTheme = {
  id: "away",

  label: "Away",

  colors: {
    /*
     * Almost-black, but with a very subtle
     * purple/plum undertone.
     *
     * This keeps it from feeling like
     * generic plain black mode.
     */

    background:
      "#080709",

    backgroundElevated:
      "#0D0A10",

    surface:
      "#120E16",

    border:
      "#2C2432",

    text:
      "#F2EFEA",

    textMuted:
      "#9B94A1",

    /*
     * Confirmed away palette.
     */

    primary:
      "#4D2280",

    secondary:
      "#080809",

    accent:
      "#C5A059",

    pitchLine:
      "#3D3147",

    success:
      "#55C995",

    danger:
      "#D75B70",

    warning:
      "#C5A059",
  },
};

const thirdTheme: KitTheme = {
  id: "third",

  label: "Third",

  colors: {
    /*
     * IMPORTANT:
     *
     * The old version used mint as the
     * full page background.
     *
     * That was the reason it felt washed-out.
     *
     * Now the environment is a dark petrol
     * shade derived from the teal/mint kit.
     */

    background:
      "#071718",

    backgroundElevated:
      "#0A2021",

    surface:
      "#0D292A",

    border:
      "#285052",

    /*
     * Slightly warm mint-white text.
     */

    text:
      "#ECF7F3",

    textMuted:
      "#91B8B1",

    /*
     * Third kit identity.
     */

    primary:
      "#00A3A6",

    /*
     * Loyal Blue.
     *
     * Using a restrained approximation
     * until we lock the exact Nike swatch.
     */

    secondary:
      "#244E9A",

    /*
     * Gym Red.
     *
     * Again, restrained approximation until
     * we have the exact jersey swatch.
     */

    accent:
      "#D9384E",

    /*
     * Actual mint kit base appears in
     * structural/pitch geometry instead
     * of flooding the entire interface.
     */

    pitchLine:
      "#A6E7D2",

    success:
      "#73D5A9",

    danger:
      "#E05A66",

    warning:
      "#D6AD66",
  },
};

export const kitThemes: Record<
  KitType,
  KitTheme
> = {
  home:
    homeTheme,

  away:
    awayTheme,

  third:
    thirdTheme,
};

/*
|--------------------------------------------------------------------------
| Theme getter
|--------------------------------------------------------------------------
|
| We keep `season` in the function signature
| because later:
|
| 2026/27 → current kits
| 2014/15 → historical kits
| 2008/09 → historical kits
|
| can all resolve differently.
|--------------------------------------------------------------------------
*/

export function getTheme(
  _season: string,
  kit: KitType,
): KitTheme {
  return kitThemes[kit];
}

export function isKitType(
  value: string | null,
): value is KitType {
  return (
    value === "home" ||
    value === "away" ||
    value === "third"
  );
}