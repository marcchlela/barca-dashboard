import { CLUB_HONOURS, CLUB_SEASONS, HONOURS_SOURCE, clubHonourDisplayName } from "./history";

export const CLUB_CABINET_GROUPS = [
  { id: "world", label: "Europe & the world", names: ["Champions League", "FIFA Club World Cup", "European Cup Winners' Cup", "European Super Cup", "Fairs Cup", "Fairs Super Cup", "Latin Cup", "Pyrenees Cup"] },
  { id: "spain", label: "Spain", names: ["Spanish League Championship", "Copa del Rey", "Spanish Super Cup", "Spanish League Cup", "Eva Duarte Cup", "Mediterranean League"] },
  { id: "catalonia", label: "Catalonia", names: ["Catalan League Championship", "Catalan League", "Catalan Cup", "Catalan Super Cup"] },
] as const;

const modelByCategory: Record<string, { modelUrl: string | null; embedUrl: string | null; previewUrl: string; modelSource: string; modelCredit: string; previewSource?: string; previewCredit?: string }> = {
  "Champions League": {
    modelUrl: "/models/club/champions-league.glb",
    embedUrl: null,
    previewUrl: "/images/club/champions-league-photo.jpg",
    modelSource: "https://www.cadcrowd.com/3d-models/uefa-champions-league-trophy",
    modelCredit: "3D model by alqosamaufa · CC0 · locally prepared in Blender",
    previewSource: "https://commons.wikimedia.org/wiki/File:2010_-_UEFA_Champions_League_Trophy.jpg",
    previewCredit: "Photo of the cup in Barça's museum · Daniel · CC BY 2.0",
  },
  "Spanish League Championship": {
    modelUrl: null,
    embedUrl: "https://sketchfab.com/models/357fc94357be46da94842f09afd1d2ff/embed?autostart=1&ui_infos=0&ui_controls=1",
    previewUrl: "/images/club/la-liga.jpg",
    modelSource: "https://sketchfab.com/3d-models/la-liga-spanish-trophy-football-award-357fc94357be46da94842f09afd1d2ff",
    modelCredit: "Interactive model by 3DserVision_studio · Sketchfab",
  },
  "Copa del Rey": {
    modelUrl: null,
    embedUrl: "https://sketchfab.com/models/6d6d9f2985bd4e77ad34df2c5c857a41/embed?autostart=1&ui_infos=0&ui_controls=1",
    previewUrl: "/images/club/copa-del-rey.jpg",
    modelSource: "https://sketchfab.com/3d-models/copa-del-rey-trophy-6d6d9f2985bd4e77ad34df2c5c857a41",
    modelCredit: "Interactive model by 3DserVision_studio · Sketchfab",
  },
};

export const CLUB_CABINET = CLUB_CABINET_GROUPS.flatMap((group) => group.names.map((name) => {
  const wins = CLUB_HONOURS.filter((honour) => honour.name === name);
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    displayName: clubHonourDisplayName(name),
    group: group.id,
    count: wins.length,
    modelUrl: modelByCategory[name]?.modelUrl ?? null,
    embedUrl: modelByCategory[name]?.embedUrl ?? null,
    previewUrl: modelByCategory[name]?.previewUrl ?? null,
    modelSource: modelByCategory[name]?.modelSource ?? null,
    modelCredit: modelByCategory[name]?.modelCredit ?? null,
    previewSource: modelByCategory[name]?.previewSource ?? null,
    previewCredit: modelByCategory[name]?.previewCredit ?? null,
    source: HONOURS_SOURCE,
    wins: wins.map((honour) => ({
      label: honour.publishedLabel,
      seasonSlug: honour.startYear === null ? null : CLUB_SEASONS.find((season) => season.startYear === honour.startYear)?.slug ?? null,
    })),
  };
}));

export type ClubCabinetItem = (typeof CLUB_CABINET)[number];
