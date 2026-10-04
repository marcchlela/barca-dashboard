import {
  asObject,
} from "../providers/shared/json";

export type HeatmapCell = {
  column:
    number;

  row:
    number;

  count:
    number;

  intensity:
    number;
};

export type MatchHeatmap = {
  matchId:
    string;

  providerMatchId:
    string;

  providerPlayerId:
    string;

  minutes:
    number;

  actions:
    number;

  sampleSize:
    number;

  columns:
    number;

  rows:
    number;

  cells:
    HeatmapCell[];
};

export type AverageHeatmap = {
  source:
    "pitchapi-match-average";

  sampleSize:
    number;

  matchesIncluded:
    number;

  columns:
    number;

  rows:
    number;

  maxCellCount:
    number;

  cells:
    HeatmapCell[];
};

type PlayerStatisticLike = {
  matchId:
    string;

  minutes:
    number | null;

  rawData:
    unknown;
};

type StoredSpatialHeatmap = {
  provider:
    string;

  providerMatchId:
    string;

  providerPlayerId:
    string;

  frame:
    string;

  grid: {
    length:
      number;

    width:
      number;
  };

  actions:
    number;

  cells:
    [
      number,
      number,
      number,
    ][];
};

/*
|--------------------------------------------------------------------------
| Player heatmap profile
|--------------------------------------------------------------------------
*/

export function buildPlayerHeatmapProfile(
  statistics:
    PlayerStatisticLike[],
) {
  const matches:
    MatchHeatmap[] =
    [];

  for (
    const statistic
    of statistics
  ) {
    const stored =
      readStoredSpatialHeatmap(
        statistic.rawData,
      );

    if (!stored) {
      continue;
    }

    const matchHeatmap =
      buildMatchHeatmap(
        statistic.matchId,
        statistic.minutes ??
          0,
        stored,
      );

    if (
      matchHeatmap
        .sampleSize >
      0
    ) {
      matches.push(
        matchHeatmap,
      );
    }
  }

  return {
    average:
      buildAverageFromMatchHeatmaps(
        matches,
      ),

    matches,
  };
}

/*
|--------------------------------------------------------------------------
| Individual match
|--------------------------------------------------------------------------
*/

function buildMatchHeatmap(
  matchId:
    string,

  minutes:
    number,

  stored:
    StoredSpatialHeatmap,
): MatchHeatmap {
  const columns =
    stored.grid.length;

  const rows =
    stored.grid.width;

  const grid =
    createGrid(
      rows,
      columns,
    );

  let sampleSize =
    0;

  for (
    const [
      column,
      row,
      count,
    ]
    of stored.cells
  ) {
    if (
      column <
        0 ||
      row <
        0 ||
      column >=
        columns ||
      row >=
        rows ||
      count <=
        0
    ) {
      continue;
    }

    grid[
      row
    ][
      column
    ] +=
      count;

    sampleSize +=
      count;
  }

  let hottestCell =
    0;

  for (
    const row
    of grid
  ) {
    for (
      const count
      of row
    ) {
      hottestCell =
        Math.max(
          hottestCell,
          count,
        );
    }
  }

  const cells:
    HeatmapCell[] =
    [];

  for (
    let row =
      0;
    row <
    rows;
    row +=
      1
  ) {
    for (
      let column =
        0;
      column <
      columns;
      column +=
        1
    ) {
      const count =
        grid[
          row
        ][
          column
        ];

      if (
        count <=
        0
      ) {
        continue;
      }

      cells.push({
        column,

        row,

        count,

        intensity:
          hottestCell >
          0
            ? round(
                count /
                  hottestCell,
                4,
              )
            : 0,
      });
    }
  }

  return {
    matchId,

    providerMatchId:
      stored.providerMatchId,

    providerPlayerId:
      stored.providerPlayerId,

    minutes,

    actions:
      stored.actions,

    sampleSize,

    columns,

    rows,

    cells,
  };
}

/*
|--------------------------------------------------------------------------
| Aggregate heatmap
|--------------------------------------------------------------------------
|
| Used for:
|
| - full-season average
| - La Liga average
| - Champions League average
| - any future competition / period average
|
| Every match is normalized independently first.
|
| After that, the match distribution is weighted by minutes played.
|--------------------------------------------------------------------------
*/

export function buildAverageFromMatchHeatmaps(
  matches:
    MatchHeatmap[],
): AverageHeatmap {
  if (
    matches.length ===
    0
  ) {
    return emptyAverage();
  }

  const base =
    matches[0];

  const columns =
    base.columns;

  const rows =
    base.rows;

  /*
   * Never mix incompatible provider
   * grids into one aggregate.
   */

  const compatible =
    matches.filter(
      (
        match,
      ) =>
        match.columns ===
          columns &&
        match.rows ===
          rows,
    );

  if (
    compatible.length ===
    0
  ) {
    return emptyAverage();
  }

  const aggregate =
    createGrid(
      rows,
      columns,
    );

  let totalWeight =
    0;

  let totalSamples =
    0;

  for (
    const match
    of compatible
  ) {
    if (
      match.sampleSize <=
      0
    ) {
      continue;
    }

    const weight =
      match.minutes >
      0
        ? match.minutes
        : 1;

    totalWeight +=
      weight;

    totalSamples +=
      match.sampleSize;

    for (
      const cell
      of match.cells
    ) {
      const share =
        cell.count /
        match.sampleSize;

      aggregate[
        cell.row
      ][
        cell.column
      ] +=
        share *
        weight;
    }
  }

  if (
    totalWeight <=
    0
  ) {
    return emptyAverage(
      columns,
      rows,
    );
  }

  for (
    let row =
      0;
    row <
    rows;
    row +=
      1
  ) {
    for (
      let column =
        0;
      column <
      columns;
      column +=
        1
    ) {
      aggregate[
        row
      ][
        column
      ] /=
        totalWeight;
    }
  }

  let hottestCell =
    0;

  for (
    const row
    of aggregate
  ) {
    for (
      const value
      of row
    ) {
      hottestCell =
        Math.max(
          hottestCell,
          value,
        );
    }
  }

  const cells:
    HeatmapCell[] =
    [];

  for (
    let row =
      0;
    row <
    rows;
    row +=
      1
  ) {
    for (
      let column =
        0;
      column <
      columns;
      column +=
        1
    ) {
      const value =
        aggregate[
          row
        ][
          column
        ];

      if (
        value <=
        0
      ) {
        continue;
      }

      cells.push({
        column,

        row,

        /*
         * For averages this is the
         * weighted distribution share.
         *
         * It intentionally stays in the
         * same field as match-cell count
         * so the UI can treat both as a
         * weighted density.
         */
        count:
          round(
            value,
            7,
          ),

        intensity:
          hottestCell >
          0
            ? round(
                value /
                  hottestCell,
                5,
              )
            : 0,
      });
    }
  }

  return {
    source:
      "pitchapi-match-average",

    sampleSize:
      totalSamples,

    matchesIncluded:
      compatible.length,

    columns,

    rows,

    maxCellCount:
      hottestCell,

    cells,
  };
}

/*
|--------------------------------------------------------------------------
| Stored rawData reader
|--------------------------------------------------------------------------
*/

function readStoredSpatialHeatmap(
  rawData:
    unknown,
): StoredSpatialHeatmap | null {
  const root =
    asObject(
      rawData,
    );

  const spatial =
    asObject(
      root?.spatialHeatmap,
    );

  if (
    !spatial ||
    spatial.provider !==
      "pitchapi-spatial"
  ) {
    return null;
  }

  const grid =
    asObject(
      spatial.grid,
    );

  const length =
    numberValue(
      grid?.length,
    );

  const width =
    numberValue(
      grid?.width,
    );

  if (
    length ===
      null ||
    width ===
      null
  ) {
    return null;
  }

  const rawCells =
    Array.isArray(
      spatial.cells,
    )
      ? spatial.cells
      : [];

  const cells:
    [
      number,
      number,
      number,
    ][] =
    [];

  for (
    const rawCell
    of rawCells
  ) {
    if (
      !Array.isArray(
        rawCell,
      ) ||
      rawCell.length <
        3
    ) {
      continue;
    }

    const column =
      numberValue(
        rawCell[0],
      );

    const row =
      numberValue(
        rawCell[1],
      );

    const count =
      numberValue(
        rawCell[2],
      );

    if (
      column ===
        null ||
      row ===
        null ||
      count ===
        null
    ) {
      continue;
    }

    cells.push([
      Math.round(
        column,
      ),

      Math.round(
        row,
      ),

      count,
    ]);
  }

  if (
    cells.length ===
    0
  ) {
    return null;
  }

  return {
    provider:
      "pitchapi-spatial",

    providerMatchId:
      typeof spatial
        .providerMatchId ===
      "string"
        ? spatial
            .providerMatchId
        : "",

    providerPlayerId:
      typeof spatial
        .providerPlayerId ===
      "string"
        ? spatial
            .providerPlayerId
        : "",

    frame:
      typeof spatial
        .frame ===
      "string"
        ? spatial.frame
        : "acting_ltr",

    grid: {
      length:
        Math.round(
          length,
        ),

      width:
        Math.round(
          width,
        ),
    },

    actions:
      numberValue(
        spatial.actions,
      ) ??
      cells.reduce(
        (
          total,
          cell,
        ) =>
          total +
          cell[2],
        0,
      ),

    cells,
  };
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function emptyAverage(
  columns =
    16,

  rows =
    12,
): AverageHeatmap {
  return {
    source:
      "pitchapi-match-average",

    sampleSize:
      0,

    matchesIncluded:
      0,

    columns,

    rows,

    maxCellCount:
      0,

    cells:
      [],
  };
}

function createGrid(
  rows:
    number,

  columns:
    number,
) {
  return Array.from(
    {
      length:
        rows,
    },
    () =>
      Array.from(
        {
          length:
            columns,
        },
        () =>
          0,
      ),
  );
}

function numberValue(
  value:
    unknown,
) {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    return value;
  }

  if (
    typeof value ===
      "string" &&
    value.trim()
  ) {
    const parsed =
      Number(
        value,
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  }

  return null;
}

function round(
  value:
    number,

  decimals:
    number,
) {
  const factor =
    10 **
    decimals;

  return (
    Math.round(
      value *
        factor,
    ) /
    factor
  );
}