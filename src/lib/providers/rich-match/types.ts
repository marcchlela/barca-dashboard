export type ChangeCount = {
  created: number;
  updated: number;
  unchanged: number;
};

export type RichSyncCounts = {
  dataSources: ChangeCount;
  providerMappings: ChangeCount;
  players: ChangeCount;
  squadMemberships: ChangeCount;
  lineups: ChangeCount;
  lineupPlayers: ChangeCount;
  events: ChangeCount;
  teamStatistics: ChangeCount;
  playerStatistics: ChangeCount;
};

export type UnresolvedIdentity = {
  providerId: string;
  name: string;
  teamProviderId: string;
  shirtNumber: number | null;
  position: string;
  reason: string;
};

export function emptySyncCounts(): RichSyncCounts {
  return {
    dataSources: { created: 0, updated: 0, unchanged: 0 },
    providerMappings: { created: 0, updated: 0, unchanged: 0 },
    players: { created: 0, updated: 0, unchanged: 0 },
    squadMemberships: { created: 0, updated: 0, unchanged: 0 },
    lineups: { created: 0, updated: 0, unchanged: 0 },
    lineupPlayers: { created: 0, updated: 0, unchanged: 0 },
    events: { created: 0, updated: 0, unchanged: 0 },
    teamStatistics: { created: 0, updated: 0, unchanged: 0 },
    playerStatistics: { created: 0, updated: 0, unchanged: 0 },
  };
}
