import {
  ArrowLeft,
  Construction,
} from "lucide-react";

import Link from "next/link";

import {
  kitThemes,
} from "../../lib/themes";

type Props = {
  eyebrow:
    string;

  title:
    string;

  description:
    string;

  items:
    string[];
};

export default function AdminPlaceholder({
  eyebrow,
  title,
  description,
  items,
}: Props) {
  const theme =
    kitThemes.home;

  return (
    <div>
      <p
        className="
          text-[9px]
          uppercase
          tracking-[0.24em]
        "
        style={{
          color:
            theme.colors.accent,
        }}
      >
        {eyebrow}
      </p>

      <h2
        className="
          mt-2
          text-2xl
          font-medium
          tracking-[-0.035em]
        "
      >
        {title}
      </h2>

      <p
        className="
          mt-3
          max-w-2xl
          text-[11px]
          leading-5
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {description}
      </p>

      <div
        className="
          mt-7
          border
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            `${theme.colors.surface}80`,
        }}
      >
        <div
          className="
            flex
            items-center
            gap-3
            border-b
            px-5
            py-4
          "
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <Construction
            size={15}
            style={{
              color:
                theme.colors.accent,
            }}
          />

          <span
            className="
              text-[9px]
              uppercase
              tracking-[0.15em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Next implementation
          </span>
        </div>

        <div>
          {items.map(
            (
              item,
              index,
            ) => (
              <div
                key={item}
                className="
                  flex
                  gap-4
                  border-b
                  px-5
                  py-4
                  last:border-b-0
                "
                style={{
                  borderColor:
                    theme.colors.border,
                }}
              >
                <span
                  className="
                    text-[9px]
                    tabular-nums
                  "
                  style={{
                    color:
                      theme.colors.accent,
                  }}
                >
                  {String(
                    index +
                      1,
                  ).padStart(
                    2,
                    "0",
                  )}
                </span>

                <span className="text-[10px]">
                  {item}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      <Link
        href="/admin"
        className="
          mt-5
          inline-flex
          items-center
          gap-2
          text-[9px]
          uppercase
          tracking-[0.12em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        <ArrowLeft
          size={12}
        />

        Back to overview
      </Link>
    </div>
  );
}