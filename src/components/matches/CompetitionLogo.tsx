import {
  Trophy,
} from "lucide-react";

import type {
  KitTheme,
} from "../../lib/themes";

type CompetitionLogoProps = {
  src:
    string | null;

  name:
    string;

  code?:
    string | null;

  theme:
    KitTheme;

  size?:
    number;
};

export default function CompetitionLogo({
  src,
  name,
  code = null,
  theme,
  size = 16,
}: CompetitionLogoProps) {
  /*
  |--------------------------------------------------------------------------
  | Competition-specific logo treatment
  |--------------------------------------------------------------------------
  |
  | Some provider competition marks are designed for light backgrounds.
  |
  | The UEFA Champions League emblem returned by the provider is dark,
  | so it needs a light monochrome treatment inside our dark kit themes.
  |--------------------------------------------------------------------------
  */

  const needsLightTreatment =
    code === "CL";

  if (!src) {
    return (
      <span
        className="
          inline-flex
          shrink-0
          items-center
          justify-center
        "
        style={{
          width:
            size,

          height:
            size,

          color:
            theme.colors.textMuted,
        }}
        title={
          name
        }
      >
        <Trophy
          size={
            Math.max(
              size - 3,
              9,
            )
          }
          strokeWidth={
            1.6
          }
        />
      </span>
    );
  }

  return (
    <span
      className="
        inline-flex
        shrink-0
        items-center
        justify-center
      "
      style={{
        width:
          size,

        height:
          size,
      }}
      title={
        name
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          src
        }
        alt=""
        className={`
          max-h-full
          max-w-full
          object-contain

          ${
            needsLightTreatment
              ? "brightness-0 invert"
              : ""
          }
        `}
      />
    </span>
  );
}