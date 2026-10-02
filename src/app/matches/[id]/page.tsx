import {
  notFound,
} from "next/navigation";

import MatchCenterClient from "../../../components/match-center/MatchCenterClient";

import {
  PlayerPerformanceProvider,
} from "../../../components/match-center/PlayerPerformanceContext";

import {
  getMatchCenter,
} from "../../../lib/matches/get-match-center";

import {
  getMatchMedia,
} from "../../../lib/matches/get-match-media";

import {
  getMatchNavigation,
} from "../../../lib/matches/get-match-navigation";

type MatchPageProps = {
  params: Promise<{
    id:
      string;
  }>;
};

export default async function MatchPage({
  params,
}: MatchPageProps) {
  const {
    id,
  } = await params;

  const [
    data,
    navigation,
    media,
  ] =
    await Promise.all([
      getMatchCenter(
        id,
      ),

      getMatchNavigation(
        id,
      ),

      getMatchMedia(
        id,
      ),
    ]);

  if (!data) {
    notFound();
  }

  return (
    <PlayerPerformanceProvider
      data={data}
    >
      <MatchCenterClient
        data={data}
        navigation={
          navigation
        }
        media={media}
      />
    </PlayerPerformanceProvider>
  );
}