"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

import PlayerPerformanceModal, {
  type MatchPlayerDetail,
} from "./PlayerPerformanceModal";

import type {
  MatchCenterData,
} from "../../lib/matches/get-match-center";

import {
  getTheme,
  type KitType,
} from "../../lib/themes";

type PlayerPerformanceContextValue = {
  openPlayer:
    (
      playerId:
        string,
    ) => void;
};

const PlayerPerformanceContext =
  createContext<
    PlayerPerformanceContextValue | null
  >(
    null,
  );

type PlayerPerformanceProviderProps = {
  data:
    MatchCenterData;

  children:
    React.ReactNode;
};

export function PlayerPerformanceProvider({
  data,
  children,
}: PlayerPerformanceProviderProps) {
  const [
    selectedPlayer,
    setSelectedPlayer,
  ] =
    useState<
      MatchPlayerDetail | null
    >(
      null,
    );

  const [
    currentKit,
  ] =
    useState<KitType>(
      () => {
        if (
          typeof window ===
          "undefined"
        ) {
          return "home";
        }

        const stored =
          window.localStorage
            .getItem(
              "barca-dashboard-kit",
            );

        if (
          stored ===
            "away" ||
          stored ===
            "third"
        ) {
          return stored;
        }

        return "home";
      },
    );

  const openPlayer =
    useCallback(
      (
        playerId:
          string,
      ) => {
        const detail =
          findPlayer(
            data,
            playerId,
          );

        if (
          detail
        ) {
          setSelectedPlayer(
            detail,
          );
        }
      },
      [
        data,
      ],
    );

  const closePlayer =
    useCallback(
      () => {
        setSelectedPlayer(
          null,
        );
      },
      [],
    );

  const theme =
    getTheme(
      data.match
        .season.label,
      currentKit,
    );

  return (
    <PlayerPerformanceContext.Provider
      value={{
        openPlayer,
      }}
    >
      {children}

      <PlayerPerformanceModal
        player={
          selectedPlayer
        }
        theme={theme}
        onClose={
          closePlayer
        }
      />
    </PlayerPerformanceContext.Provider>
  );
}

export function usePlayerPerformance() {
  const context =
    useContext(
      PlayerPerformanceContext,
    );

  if (!context) {
    throw new Error(
      "usePlayerPerformance must be used inside PlayerPerformanceProvider.",
    );
  }

  return context;
}

function findPlayer(
  data:
    MatchCenterData,

  playerId:
    string,
): MatchPlayerDetail | null {
  const lineups = [
    data.lineups.home,
    data.lineups.away,
  ];

  for (
    const lineup
    of lineups
  ) {
    if (!lineup) {
      continue;
    }

    const player =
      [
        ...lineup.starters,
        ...lineup.bench,
      ].find(
        (
          entry,
        ) =>
          entry.player.id ===
          playerId,
      );

    if (player) {
      const performance =
        [
          ...data
            .performances
            .barcelona,

          ...data
            .performances
            .opponent,
        ].find(
          (
            item,
          ) =>
            item.player.id ===
            playerId,
        );

      return {
        player:
          player.player,

        team:
          lineup.team,

        statistics:
          player.statistics ??
          performance
            ?.statistics ??
          null,

        shirtNumber:
          player.shirtNumber,

        role:
          player.role,
      };
    }
  }

  const performance =
    [
      ...data
        .performances
        .barcelona,

      ...data
        .performances
        .opponent,
    ].find(
      (
        item,
      ) =>
        item.player.id ===
        playerId,
    );

  if (!performance) {
    return null;
  }

  return {
    player:
      performance.player,

    team:
      performance.team,

    statistics:
      performance
        .statistics,

    shirtNumber:
      null,

    role:
      null,
  };
}