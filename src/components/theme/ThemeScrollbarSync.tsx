"use client";

import {
  useEffect,
} from "react";

import type {
  KitTheme,
} from "../../lib/themes";

type ThemeScrollbarSyncProps = {
  theme:
    KitTheme;
};

export default function ThemeScrollbarSync({
  theme,
}: ThemeScrollbarSyncProps) {
  useEffect(() => {
    const root =
      document.documentElement;

    const properties = {
      "--scrollbar-thumb":
        theme.colors.accent,

      "--scrollbar-thumb-hover":
        theme.colors.text,

      "--scrollbar-track":
        theme.colors.background,

      "--scrollbar-border":
        theme.colors.backgroundElevated,
    };

    const previous =
      Object.fromEntries(
        Object.keys(
          properties,
        ).map(
          (
            name,
          ) => [
            name,
            root.style
              .getPropertyValue(
                name,
              ),
          ],
        ),
      );

    for (
      const [
        name,
        value,
      ]
      of Object.entries(
        properties,
      )
    ) {
      root.style.setProperty(
        name,
        value,
      );
    }

    return () => {
      for (
        const [
          name,
          value,
        ]
        of Object.entries(
          previous,
        )
      ) {
        if (value) {
          root.style.setProperty(
            name,
            value,
          );
        } else {
          root.style.removeProperty(
            name,
          );
        }
      }
    };
  }, [
    theme.colors.accent,
    theme.colors.background,
    theme.colors.backgroundElevated,
    theme.colors.text,
  ]);

  return null;
}