export const CELL = 1;

export const TILE_TYPES = {
  FOREST: "forest",
  FIELD: "field",
  RIVER: "river",
  ROAD: "road",
  TOWN: "town",
  EMPTY: "empty",
};

export const BURN_DURATIONS = {
  [TILE_TYPES.FOREST]: 6000,
  [TILE_TYPES.FIELD]: 2000,
  [TILE_TYPES.TOWN]: 10000,
};

export const MAP_LAYOUT = [
  "~~~~~~~~~~~~RR",
  "~~~~~FFFRRRRRR",
  "~~FFFFFRRRRTTT",
  "~FFFFFRRRTTTTT",
  "~FFFFFRRRRRTTT",
  "~FFFFFRR~~RRRR",
  "~~FFFfRR~~RRRR",
  "~~FFfRRRRRRRRR",
  "~~FFRRRffffRRf",
  "~~RRRRfffffRRf",
  "TRRRRRffffffRf",
  "TRRRRRffffffRf",
  "TRRRRRffffffRf",
  "TRRRRRffffffRf",
  "TRRRRRffffffRf",
  "TRRRRRffffffRf",
];

export const LEGEND = {
  "~": TILE_TYPES.RIVER,
  "F": TILE_TYPES.FOREST,
  "f": TILE_TYPES.FIELD,
  "R": TILE_TYPES.ROAD,
  "T": TILE_TYPES.TOWN,
  ".": TILE_TYPES.EMPTY,
};

export const FIRE_START = { x: MAP_LAYOUT[0].length - 1, y: MAP_LAYOUT.length - 1 };

export const TRUCK_COUNT = 6;
export const TRUCK_RANGE = 5;

export const PLANE_COOLDOWN = 12000;
export const PLANE_CAPACITY = 4;
