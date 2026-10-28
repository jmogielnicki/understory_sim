// The village plan: everything the settlement builds, as data (world metres; x east, z south; heights from
// the measured terrain unless given). Edit freely: Settlement.js rebuilds the grading, the meshes, the
// colliders, the plants' exclusions and the light sources from it. See docs/REFERENCE.md for the look.
//
// The site is the north shore of Squam Lake: a sheltered cove (its head near z = -245 between x = 260 and
// 420), the south-facing slope of Rattlesnake above it (hillside A, ~25 % grade) and a slope facing
// south-west on its east side (hillside B). Homes are terraced along both, a row per contour shelf, each
// row staggered so the homes above look out over the planted roofs below. The open, gentler ground at the
// cove head holds the green; a stream comes down the ravine west of it, through a lily pond into the cove;
// the communal buildings stand between the green and the water.
//
// homes (settlement/Home.js, reference/home-v2.png): x, z = centre of the front wall at floor level; yaw = the
//   direction it faces (0 south, -PI/2 west); len = length along the front (m), depth = how far the body runs
//   back into the hill; loggia = 'left' | 'right' | null: the great open arch (an outdoor kitchen under a
//   vault) at that end; terrace = paved depth in front; seam = the pale blue technology line round the arch;
//   porch = 'pergola' | 'awning' | 'none' over the front (default: either); garden = beds and a woodshed
//   beside its left end (true, or its width in m: it fills the gap to the next home); floor = optional floor height (default: the natural ground at the front, dug in a little).
// ROWS: the homes along each contour shelf (low to high per hillside); a walk runs in front of each row's
//   terraces and stairs climb between the homes to the row above (see rowPaths below).
export const HOMES = [
	// (rows laid along the hill's contours by tools/layout/rows.mjs; edit freely)
	// ---- row A1
	{ id: 'A1a', x: 279.9, z: - 334.1, yaw: 0.02, len: 15.5, depth: 9, loggia: null, terrace: 4.7 },
	{ id: 'A1b', name: 'Mimi', x: 324, z: - 338, yaw: - 0.02, len: 18, depth: 10, loggia: 'right', loggiaSpan: 6.6, loggiaRise: 4.7, wall: 3.3, roofRise: 2.4, terrace: 6.2, seam: true, porch: 'pergola', garden: 14, skylights: 1, smoke: true, roundHigh: true, cell: 0.14 },
	{ id: 'A1c', x: 351.8, z: - 341.1, yaw: - 0.19, len: 14, depth: 9.5, loggia: null, terrace: 5.3, seam: true },
	{ id: 'A1d', x: 369.8, z: - 335.1, yaw: - 0.06, len: 12.5, depth: 9, loggia: null, terrace: 4.9 },
	{ id: 'A1e', x: 388.5, z: - 340.5, yaw: 0.06, len: 14, depth: 9, loggia: 'left', terrace: 5.3 },
	{ id: 'A1f', x: 409.1, z: - 340.9, yaw: - 0.04, len: 13.5, depth: 9.5, loggia: 'left', terrace: 5.1 },
	{ id: 'A1g', x: 428.8, z: - 337.2, yaw: - 0.23, len: 13, depth: 10, loggia: 'left', terrace: 5.4 },
	{ id: 'A1h', x: 449, z: - 331.2, yaw: - 0.28, len: 16, depth: 10, loggia: null, terrace: 4.7 },
	// ---- row A2
	{ id: 'A2a', x: 294, z: - 364.1, yaw: 0.2, len: 12.5, depth: 10, loggia: null, terrace: 4.7 },
	{ id: 'A2b', x: 312.8, z: - 370.7, yaw: 0.17, len: 15, depth: 9.5, loggia: null, terrace: 4.7 },
	{ id: 'A2c', x: 333.4, z: - 374.4, yaw: 0.04, len: 14, depth: 9, loggia: null, terrace: 4.6, seam: true },
	{ id: 'A2d', x: 352.1, z: - 371.3, yaw: - 0.04, len: 13, depth: 8.5, loggia: null, terrace: 4.9 },
	{ id: 'A2e', x: 379.8, z: - 369.9, yaw: 0, len: 16, depth: 9.5, loggia: 'left', terrace: 5.2, garden: 10 },
	{ id: 'A2f', x: 401.6, z: - 372.9, yaw: - 0.02, len: 14.5, depth: 10, loggia: null, terrace: 5.3 },
	{ id: 'A2g', x: 421.5, z: - 371.2, yaw: - 0.19, len: 14, depth: 9.5, loggia: 'right', terrace: 4.7 },
	{ id: 'A2h', x: 442.4, z: - 364.3, yaw: - 0.33, len: 15.5, depth: 8.5, loggia: 'right', terrace: 5.3 },
	{ id: 'A2i', x: 466.7, z: - 352.8, yaw: - 0.4, len: 13.5, depth: 9, loggia: null, terrace: 4.7, garden: 9 },
	// ---- row A3
	{ id: 'A3a', x: 305.8, z: - 394.3, yaw: 0.12, len: 15.5, depth: 9.5, loggia: 'right', terrace: 5 },
	{ id: 'A3b', x: 325.6, z: - 397.5, yaw: 0.05, len: 13, depth: 9, loggia: null, terrace: 4.8, seam: true },
	{ id: 'A3c', x: 352.5, z: - 396.8, yaw: - 0.02, len: 14.5, depth: 10, loggia: null, terrace: 4.5, garden: 10 },
	{ id: 'A3d', x: 379.4, z: - 395, yaw: - 0.05, len: 13, depth: 9.5, loggia: 'right', terrace: 4.8, garden: 10 },
	{ id: 'A3e', x: 399.4, z: - 394.2, yaw: - 0.09, len: 14.5, depth: 10, loggia: null, terrace: 5.2 },
	{ id: 'A3f', x: 420.3, z: - 392.8, yaw: - 0.18, len: 13.5, depth: 9.5, loggia: 'right', terrace: 4.9 },
	{ id: 'A3g', x: 439.9, z: - 385.2, yaw: - 0.3, len: 15.5, depth: 9.5, loggia: null, terrace: 4.9 },
	{ id: 'A3h', x: 460.3, z: - 380.7, yaw: - 0.36, len: 14, depth: 9, loggia: 'left', terrace: 4.6 },
	// ---- row A4
	{ id: 'A4a', x: 316.9, z: - 427.7, yaw: - 0.11, len: 14, depth: 9.5, loggia: 'right', terrace: 5 },
	{ id: 'A4b', x: 336.3, z: - 423.8, yaw: - 0.09, len: 15, depth: 9.5, loggia: 'left', terrace: 5.4 },
	{ id: 'A4c', x: 357.9, z: - 425.7, yaw: - 0.16, len: 15, depth: 9, loggia: null, terrace: 5.2 },
	{ id: 'A4d', x: 377.3, z: - 417.6, yaw: - 0.15, len: 14.5, depth: 9.5, loggia: null, terrace: 4.8 },
	{ id: 'A4e', x: 396.8, z: - 415.6, yaw: - 0.05, len: 13, depth: 8.5, loggia: null, terrace: 5.1 },
	{ id: 'A4f', x: 415.5, z: - 418.7, yaw: - 0.07, len: 13, depth: 9.5, loggia: 'left', terrace: 5.5, seam: true },
	{ id: 'A4g', x: 441.4, z: - 411.6, yaw: - 0.27, len: 14.5, depth: 9.5, loggia: null, terrace: 5.2, garden: 10 },
	{ id: 'A4h', x: 461.3, z: - 404.8, yaw: - 0.45, len: 13, depth: 9, loggia: 'right', terrace: 4.8 },
	{ id: 'A4i', x: 478.6, z: - 393.2, yaw: - 0.53, len: 15, depth: 9, loggia: 'right', terrace: 4.9 },
	// ---- row A5
	{ id: 'A5a', x: 325.7, z: - 452.9, yaw: - 0.14, len: 16, depth: 9.5, loggia: null, terrace: 4.8 },
	{ id: 'A5b', x: 348.3, z: - 449.6, yaw: - 0.22, len: 15.5, depth: 9, loggia: 'right', terrace: 5.4 },
	{ id: 'A5c', x: 373, z: - 439, yaw: - 0.17, len: 13, depth: 9, loggia: null, terrace: 4.6, seam: true, garden: 9 },
	{ id: 'A5d', x: 398.5, z: - 437.2, yaw: - 0.11, len: 13, depth: 9.5, loggia: 'left', terrace: 5.1, garden: 9 },
	{ id: 'A5e', x: 418.3, z: - 436.4, yaw: - 0.14, len: 15, depth: 8.5, loggia: null, terrace: 5.4, seam: true },
	{ id: 'A5f', x: 437.7, z: - 431.6, yaw: - 0.25, len: 13, depth: 9, loggia: 'right', terrace: 4.8, seam: true },
	{ id: 'A5g', x: 469.4, z: - 419.4, yaw: - 0.25, len: 13.5, depth: 9.5, loggia: 'left', terrace: 4.8, seam: true, garden: 17 },
	// ---- row A6
	{ id: 'A6a', x: 374.1, z: - 455.3, yaw: - 0.18, len: 16, depth: 10, loggia: null, terrace: 4.5, seam: true },
	{ id: 'A6b', x: 393.3, z: - 457.2, yaw: - 0.12, len: 13, depth: 9.5, loggia: 'right', terrace: 5 },
	{ id: 'A6c', x: 414.7, z: - 454.6, yaw: - 0.15, len: 16, depth: 9, loggia: 'left', terrace: 4.5 },
	{ id: 'A6d', x: 443.5, z: - 446.4, yaw: - 0.28, len: 14, depth: 9, loggia: null, terrace: 4.9, garden: 11 },
	{ id: 'A6e', x: 463.6, z: - 440.2, yaw: - 0.24, len: 13.5, depth: 9, loggia: 'left', terrace: 4.9, seam: true },
	{ id: 'A6f', x: 483, z: - 435.8, yaw: - 0.19, len: 13, depth: 9, loggia: null, terrace: 5.4 },
	// ---- row B1
	{ id: 'B1a', x: 463.9, z: - 302.3, yaw: - 0.73, len: 14, depth: 9.5, loggia: 'left', terrace: 4.7, seam: true },
	{ id: 'B1b', x: 479, z: - 286.4, yaw: - 0.78, len: 15, depth: 9.5, loggia: 'left', terrace: 4.6 },
	{ id: 'B1c', x: 493.5, z: - 271.2, yaw: - 0.69, len: 13, depth: 8.5, loggia: 'right', terrace: 4.9 },
	{ id: 'B1d', x: 508.5, z: - 258.3, yaw: - 0.38, len: 16, depth: 9.5, loggia: 'right', terrace: 4.6 },
	{ id: 'B1e', x: 536, z: - 258.4, yaw: - 0.05, len: 13.5, depth: 10, loggia: null, terrace: 5.2, seam: true, garden: 9 },
	// ---- row B2
	{ id: 'B2a', x: 486.9, z: - 327.9, yaw: - 0.5, len: 15, depth: 9.5, loggia: null, terrace: 5, seam: true },
	{ id: 'B2b', x: 506.3, z: - 317.3, yaw: - 0.41, len: 15.5, depth: 9.5, loggia: 'right', terrace: 5.4 },
	{ id: 'B2c', x: 525.5, z: - 309.2, yaw: - 0.3, len: 13, depth: 9, loggia: 'right', terrace: 4.9 },
	{ id: 'B2d', x: 545.4, z: - 307.5, yaw: - 0.32, len: 15.5, depth: 9, loggia: 'left', terrace: 5.1 },
	{ id: 'B2e', x: 562.7, z: - 296.4, yaw: - 0.45, len: 15, depth: 9.5, loggia: 'right', terrace: 4.7 },
	// ---- row B3
	{ id: 'B3a', x: 507.4, z: - 346.4, yaw: - 0.33, len: 12.5, depth: 8.5, loggia: null, terrace: 4.7, seam: true },
	{ id: 'B3b', x: 525.4, z: - 340.5, yaw: - 0.17, len: 13, depth: 9, loggia: 'right', terrace: 4.9 },
	{ id: 'B3c', x: 545.4, z: - 339.6, yaw: - 0.07, len: 15, depth: 8.5, loggia: 'right', terrace: 4.8 },
	{ id: 'B3d', x: 567.2, z: - 341.3, yaw: - 0.08, len: 15, depth: 8.5, loggia: null, terrace: 4.5 },
	// ---- row B4
	{ id: 'B4a', x: 531.8, z: - 365, yaw: - 0.06, len: 15, depth: 8.5, loggia: 'left', terrace: 4.6 },
	{ id: 'B4b', x: 551.7, z: - 365.1, yaw: 0.05, len: 12.5, depth: 8.5, loggia: null, terrace: 4.8, seam: true },
	{ id: 'B4c', x: 571.5, z: - 368, yaw: 0.14, len: 13, depth: 9.5, loggia: 'right', terrace: 4.6 },
	// ---- hillside A west of the stream, facing south-east over the pond
	{ id: 'AWa', x: 226, z: - 356, yaw: 0.38, len: 14.5, depth: 9, loggia: 'right', terrace: 5, seam: true },
	{ id: 'AWb', x: 238, z: - 392, yaw: 0.3, len: 13.5, depth: 9.5, loggia: null, terrace: 4.5 , garden: 9 },
	{ id: 'AWc', x: 262, z: - 428, yaw: - 0.25, len: 14.5, depth: 9, loggia: 'right', terrace: 4.5 },
];
export const ROWS = [
	[ 'A1a', 'A1b', 'A1c', 'A1d', 'A1e', 'A1f', 'A1g', 'A1h' ],
	[ 'A2a', 'A2b', 'A2c', 'A2d', 'A2e', 'A2f', 'A2g', 'A2h', 'A2i' ],
	[ 'A3a', 'A3b', 'A3c', 'A3d', 'A3e', 'A3f', 'A3g', 'A3h' ],
	[ 'A4a', 'A4b', 'A4c', 'A4d', 'A4e', 'A4f', 'A4g', 'A4h', 'A4i' ],
	[ 'A5a', 'A5b', 'A5c', 'A5d', 'A5e', 'A5f', 'A5g' ],
	[ 'A6a', 'A6b', 'A6c', 'A6d', 'A6e', 'A6f' ],
	[ 'B1a', 'B1b', 'B1c', 'B1d', 'B1e' ],
	[ 'B2a', 'B2b', 'B2c', 'B2d', 'B2e' ],
	[ 'B3a', 'B3b', 'B3c', 'B3d' ],
	[ 'B4a', 'B4b', 'B4c' ],
];
// stairs between rows: [ lower, upper ] (indices into ROWS) and the gaps of the lower row they climb through
// (0 = between its first two homes)
export const STAIRS = [
	{ rows: [ 0, 1 ], gaps: [ 2, 4 ] }, { rows: [ 1, 2 ], gaps: [ 2, 5 ] }, { rows: [ 2, 3 ], gaps: [ 3, 4 ] }, { rows: [ 3, 4 ], gaps: [ 2, 6 ] }, { rows: [ 4, 5 ], gaps: [ 0, 4 ] }, { rows: [ 6, 7 ], gaps: [ 2 ] }, { rows: [ 7, 8 ], gaps: [ 2 ] }, { rows: [ 8, 9 ], gaps: [ 1 ] },
];

// Sky flowers (SkyFlowers.js): the village's solar collectors, tall white flowers over the trees (reference/
// neighborhood-v2.png has them on the far hillside): [ x, z, height (m), yaw ]. On the hamlet's point across
// the water and on the slope above the village's top rows.
export const SKY_FLOWERS = [
	[ - 646, 236, 34, 0.3 ], [ - 664, 345, 38, 1.1 ], [ - 652, 448, 33, 2.0 ], [ - 612, 395, 30, 0.7 ],
	[ 300, - 463, 34, 0.4 ], [ 478, - 470, 38, 1.4 ], [ 590, - 380, 32, 2.6 ],
];

// The village clearing: the tended land the homes stand in (meadows, scattered trees, gardens); the forest
// closes in beyond it (a ragged edge, see Settlement)
export const CLEARING = [
	[ 196, - 252 ], [ 192, - 300 ], [ 186, - 352 ], [ 200, - 405 ], [ 240, - 452 ], [ 300, - 468 ], [ 362, - 474 ], [ 424, - 478 ],
	[ 476, - 466 ], [ 530, - 420 ], [ 582, - 392 ], [ 604, - 340 ], [ 576, - 270 ], [ 548, - 226 ], [ 516, - 186 ], [ 462, - 196 ],
	[ 420, - 222 ], [ 340, - 236 ], [ 280, - 232 ],
];

// The green: an open, gently sloping lawn (polygon), with natural play structures
// (reference/neighborhood-v2.png: it runs down to the shore, the village's gathering ground: big shade trees,
// strings of lanterns and long tables, see FESTIVAL)
export const GREEN = [ [ 262, - 320 ], [ 300, - 325 ], [ 345, - 326 ], [ 392, - 322 ], [ 404, - 312 ], [ 398, - 292 ], [ 392, - 276 ], [ 366, - 266 ], [ 332, - 263 ], [ 304, - 266 ], [ 296, - 280 ], [ 280, - 292 ], [ 262, - 300 ] ];
// The festival ground on the green's lower half: oaks (x, z, size), lantern poles (x, z) strung to each other
// and to the trees, long trestle tables with benches (x, z, yaw)
export const FESTIVAL = {
	oaks: [ [ 318, - 297, 1.35 ], [ 360, - 301, 1.45 ], [ 386, - 284, 1.25 ], [ 334, - 272, 1.2 ] ],
	poles: [ [ 326, - 288 ], [ 344, - 293 ], [ 371, - 290 ], [ 376, - 276 ], [ 356, - 271 ], [ 316, - 279 ] ],
	// strings: pairs of anchors (index into poles, or 'o' + index into oaks)
	strings: [ [ 0, 1 ], [ 1, 2 ], [ 2, 3 ], [ 3, 4 ], [ 4, 5 ], [ 5, 0 ], [ 'o0', 0 ], [ 'o1', 1 ], [ 'o1', 2 ], [ 'o2', 3 ], [ 'o3', 4 ], [ 'o3', 5 ], [ 0, 3 ], [ 1, 4 ] ],
	tables: [ [ 340, - 283, 0.12 ], [ 357, - 285, 0.08 ], [ 348, - 277, 0.1 ], [ 330, - 280, 0.15 ] ],
	// the crowd (Crowd.js): circles of people talking, [ x, z, how many ]
	circles: [ [ 338, - 289, 3 ], [ 352, - 280.5, 2 ], [ 364, - 288.5, 4 ], [ 325.5, - 275, 3 ], [ 345, - 270.5, 2 ], [ 371, - 281, 3 ], [ 333, - 293.5, 2 ], [ 357.5, - 293, 2 ],
		[ 341.5, - 276.5, 3 ], [ 366, - 276, 3 ], [ 318, - 285, 2 ], [ 380, - 286, 2 ] ],
};
// people standing on the terraces of homes: [ home id, x along the front, out from it, turn (rad) ]
export const RESIDENTS = [ [ 'A1b', 2.4, 2.8, 0.3 ], [ 'A2c', - 1.5, 2.2, - 0.2 ], [ 'B1a', 1.0, 2.5, 0.1 ] ];
export const PLAY = [
	{ kind: 'logFrame', x: 318, z: - 312, yaw: 0.3 },
	{ kind: 'balanceLog', x: 342, z: - 316, yaw: - 0.4, len: 7 },
	{ kind: 'balanceLog', x: 356, z: - 312, yaw: 0.9, len: 5.5 },
	{ kind: 'logFrame', x: 372, z: - 316, yaw: - 0.6 },
	{ kind: 'boulders', x: 296, z: - 314, r: 3 },
	{ kind: 'boulders', x: 386, z: - 312, r: 2.4 },
];

// Gardens: terraced raised beds with pergolas, between the green and hillside B
export const GARDENS = [
	{ x: 418, z: - 318, yaw: - 0.55, rows: 3, cols: 2, bed: [ 1.3, 4.2 ] },
	{ x: 428, z: - 292, yaw: - 0.6, rows: 2, cols: 3, bed: [ 1.3, 3.6 ] },
	{ x: 408, z: - 276, yaw: - 0.4, rows: 2, cols: 2, bed: [ 1.2, 3.4 ] },
	// west of the green, between the stream and the festival ground
	{ x: 281, z: - 271, yaw: 0.05, rows: 3, cols: 2, bed: [ 1.3, 4.0 ] },
	// below the pond, across the stream
	{ x: 228, z: - 276, yaw: 0.2, rows: 2, cols: 3, bed: [ 1.2, 3.4 ] },
];
// A small orchard of apple trees in rows beside the gardens (x, z of its centre, rows x cols, spacing, yaw)
export const ORCHARD = { x: 448, z: - 250, rows: 3, cols: 4, spacing: 6.5, yaw: - 0.6 };

export const PERGOLAS = [
	{ x: 432, z: - 308, yaw: - 0.55, len: 9, w: 2.6 },
	{ x: 398, z: - 288, yaw: - 0.35, len: 7, w: 2.4 },
	{ x: 282, z: - 283, yaw: 0.05, len: 8, w: 2.4 },
];

// The stream: centreline from the ravine on Rattlesnake down to the cove. w = width (m); fall = a little
// waterfall at that point. The pond takes it in and lets it out (POND.inlet / outlet are path indices).
export const STREAM = [
	{ x: 322, z: - 540, w: 1.4 },
	{ x: 319, z: - 500, w: 1.5, fall: true },
	{ x: 310, z: - 462, w: 1.6 },
	{ x: 298, z: - 432, w: 1.7, fall: true },
	{ x: 289, z: - 404, w: 1.8 },
	{ x: 281, z: - 380, w: 1.9, fall: true },
	{ x: 270, z: - 358, w: 2.0 },
	{ x: 258, z: - 338, w: 2.1, fall: true },
	{ x: 248, z: - 326, w: 2.2 }, // into the pond
	{ x: 252, z: - 300, w: 2.2 }, // out of the pond
	{ x: 262, z: - 282, w: 2.4 },
	{ x: 272, z: - 262, w: 2.6, fall: true },
	{ x: 281, z: - 246, w: 3.0 }, // the mouth, in the cove
];
export const POND = { x: 240, z: - 312, rx: 15, rz: 11, yaw: 0.35, level: 7.2, depth: 1.3, inlet: 8, outlet: 9 };

// Footbridges: where the paths cross the stream (x, z, yaw of the span, length)
export const BRIDGES = [
	{ x: 269, z: - 356, yaw: 1.05, len: 7 },
	{ x: 258, z: - 287, yaw: 1.25, len: 7.5 },
	{ x: 289, z: - 405, yaw: 1.2, len: 6.5 },
	{ x: 276, z: - 252, yaw: 1.4, len: 8 },
];

// Paths: polylines (x, z) with half widths. Stairs are built where a path climbs steeper than ~1 in 7. The walks
// along the rows and the stairs between them are added from ROWS and STAIRS (rowPaths, below).
const MANUAL_PATHS = [
	// along the shore of the cove, from the stream mouth past the green to the dock and on east
	{ w: 1.3, pave: true, pts: [ [ 236, - 262 ], [ 258, - 258 ], [ 276, - 252 ], [ 300, - 258 ], [ 330, - 257 ], [ 362, - 259 ], [ 390, - 256 ], [ 401, - 252 ], [ 425, - 244 ], [ 448, - 232 ], [ 472, - 222 ], [ 498, - 214 ] ] },
	// along the top of the green, below the first row's terraces (the first row's walk)
	{ w: 1.3, pts: [ [ 262, - 324 ], [ 286, - 326 ], [ 300, - 328 ], [ 345, - 329 ], [ 392, - 326 ], [ 410, - 314 ], [ 412, - 296 ] ] },
	// from the west bridge down past the gardens to the shore
	{ w: 1.25, pts: [ [ 258, - 287 ], [ 276, - 287 ], [ 292, - 279 ], [ 300, - 262 ] ] },
	// west of the stream: the pond, the homes there, up to the second and third rows across the bridges
	// (toWalk: the path ends at the start of that row's walk, see rowPaths)
	{ w: 1.25, toWalk: 1, pts: [ [ 258, - 287 ], [ 240, - 290 ], [ 219, - 298 ], [ 208, - 316 ], [ 213, - 336 ], [ 232, - 347 ], [ 252, - 352 ], [ 269, - 356 ] ] },
	{ w: 1.15, toWalk: 2, pts: [ [ 213, - 336 ], [ 206, - 358 ], [ 218, - 377 ], [ 236, - 384 ], [ 262, - 396 ], [ 289, - 405 ] ] },
	{ w: 1.15, pts: [ [ 262, - 396 ], [ 260, - 410 ], [ 261, - 421 ] ] },
	// the green to the gardens, and on to hillside B's first and second rows
	{ w: 1.35, pts: [ [ 392, - 276 ], [ 404, - 286 ], [ 418, - 300 ], [ 436, - 312 ] ] },
	{ w: 1.25, toWalk: 7, pts: [ [ 412, - 296 ], [ 424, - 306 ], [ 436, - 312 ], [ 450, - 322 ] ] },
	// hillside B's first row down to the shore path
	{ w: 1.25, pts: [ [ 487, - 244 ], [ 494, - 230 ], [ 498, - 214 ] ] },
	// the dock
	{ w: 1.0, pave: true, pts: [ [ 401, - 252 ], [ 400, - 247 ] ] },
];

// a walk in front of a row's terraces (each home's front pushed out past its terrace, both ends of each),
// and stairs from one row's walk up between two of its homes to the walk of the row above
function rowWalk( ids ) {

	const pts = [];
	for ( const id of ids ) {

		const h = HOMES.find( ( q ) => q.id === id );
		const s = Math.sin( h.yaw ), c = Math.cos( h.yaw );
		const out = h.terrace + 1.9, half = h.len / 2 + 1.2;
		const fx = h.x + s * out, fz = h.z + c * out;
		pts.push( [ fx - c * half, fz + s * half ], [ fx + c * half, fz - s * half ] );

	}

	return pts.map( ( [ x, z ] ) => [ Math.round( x * 10 ) / 10, Math.round( z * 10 ) / 10 ] );

}

function nearestOn( pts, x, z ) {

	let best = null, bd = Infinity;
	for ( let i = 0; i < pts.length - 1; i ++ ) {

		const [ ax, az ] = pts[ i ], [ bx, bz ] = pts[ i + 1 ];
		const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max( 0, Math.min( 1, ( ( x - ax ) * dx + ( z - az ) * dz ) / l2 ) );
		const px = ax + dx * t, pz = az + dz * t, d = Math.hypot( px - x, pz - z );
		if ( d < bd ) {

			bd = d; best = [ px, pz ];

		}

	}

	return best;

}

function rowPaths() {

	const walks = ROWS.map( rowWalk );
	const out = [];
	walks.forEach( ( w, i ) => out.push( { w: 1.3, pts: w, row: i } ) );
	// the manual paths that lead to a row's walk end at its start
	for ( const p of MANUAL_PATHS ) if ( p.toWalk !== undefined ) p.pts.push( walks[ p.toWalk ][ 0 ] );
	// stairs up from the green's top path to the first row
	for ( const g of GREEN_STAIRS ) {

		const w = walks[ 0 ];
		const ax = ( w[ g * 2 + 1 ][ 0 ] + w[ g * 2 + 2 ][ 0 ] ) / 2, az = ( w[ g * 2 + 1 ][ 1 ] + w[ g * 2 + 2 ][ 1 ] ) / 2;
		const lo = nearestOn( MANUAL_PATHS[ 1 ].pts, ax, az );
		out.push( { w: 1.2, stair: true, pts: [ lo, [ ( ax + lo[ 0 ] ) / 2, ( az + lo[ 1 ] ) / 2 ], [ ax, az ] ] } );

	}

	for ( const st of STAIRS ) {

		const [ lo, hi ] = st.rows;
		for ( const g of st.gaps ) {

			const w = walks[ lo ];
			// the gap: between the right end of home g and the left end of home g + 1
			const ax = ( w[ g * 2 + 1 ][ 0 ] + w[ g * 2 + 2 ][ 0 ] ) / 2, az = ( w[ g * 2 + 1 ][ 1 ] + w[ g * 2 + 2 ][ 1 ] ) / 2;
			const top = nearestOn( walks[ hi ], ax, az );
			out.push( { w: 1.2, stair: true, pts: [ [ ax, az ], [ ( ax + top[ 0 ] ) / 2, ( az + top[ 1 ] ) / 2 ], top ] } );

		}

	}

	return out;

}

// gaps of the first row with stairs down to the green
const GREEN_STAIRS = [ 2, 4 ];

export const PATHS = [ ...rowPaths(), ...MANUAL_PATHS ];

// Glacial erratics: big lichened granite boulders left among the homes and the meadows (x, z, radius)
export const ERRATICS = [
	[ 262, - 314, 2.2 ], [ 284, - 346, 1.6 ], [ 233, - 330, 1.8 ], [ 455, - 336, 2.4 ], [ 410, - 330, 1.4 ], [ 300, - 392, 2.0 ],
	[ 372, - 396, 1.5 ], [ 452, - 404, 2.6 ], [ 528, - 322, 1.8 ], [ 470, - 300, 1.3 ], [ 214, - 300, 2.0 ], [ 287, - 270, 1.4 ],
	[ 410, - 260, 1.6 ], [ 250, - 380, 1.7 ], [ 500, - 290, 1.5 ], [ 328, - 360, 1.2 ], [ 562, - 300, 2.2 ], [ 448, - 260, 1.4 ],
];

// Designed vistas: corridors kept free of trees (half-width w, metres), from where you first stand
// (WORLD.start, above the first rows) down over the green to the cove
export const VISTAS = [
	{ from: [ 290, - 400 ], to: [ 350, - 270 ], w: 12 },
	{ from: [ 290, - 400 ], to: [ 324, - 330 ], w: 8 },
];

export const DOCK = { x: 400.5, zStart: - 250, zEnd: - 214, width: 1.8, headWidth: 7, headDepth: 3.6, deck: 0.62 };

// Small craft on the lake: two day sailers at anchor, a kayak drawn up in the cove, a rowboat at the dock
export const BOATS = [
	{ kind: 'sail', x: 360, z: 160, yaw: 2.6, len: 6.5, color: 'white' },
	{ kind: 'sail', x: 120, z: 430, yaw: 0.9, len: 5.6, color: 'blue' },
	{ kind: 'kayak', x: 318, z: - 226, yaw: 1.2, color: 'red' },
	{ kind: 'row', x: 397.6, z: - 232, yaw: 0.05, color: 'green' },
];

// A hamlet across the water on the long point to the west (the layout image shows a second settlement on the
// far shore): six homes facing east over the lake toward the village, in their own clearing
export const HAMLET = [
	{ id: 'H1', x: - 626, z: 205, yaw: 1.45, len: 14, depth: 8.5, loggia: 'right', terrace: 4.5, seam: true, cell: 0.3 },
	{ id: 'H2', x: - 640, z: 262, yaw: 1.62, len: 13.5, depth: 9, loggia: null, terrace: 4.5, cell: 0.3 },
	{ id: 'H3', x: - 648, z: 318, yaw: 1.55, len: 12, depth: 8.5, loggia: null, terrace: 4.5, cell: 0.3 },
	{ id: 'H4', x: - 652, z: 372, yaw: 1.5, len: 14.8, depth: 9, loggia: 'right', terrace: 4.5, seam: true, cell: 0.3 },
	{ id: 'H5', x: - 640, z: 425, yaw: 1.35, len: 13.5, depth: 8.5, loggia: null, terrace: 4.5, cell: 0.3 },
	{ id: 'H6', x: - 668, z: 470, yaw: 1.2, len: 12.7, depth: 9, loggia: 'left', terrace: 4.5, cell: 0.3 },
];
export const HAMLET_CLEARING = [
	[ - 600, 170 ], [ - 578, 240 ], [ - 584, 320 ], [ - 590, 400 ], [ - 596, 460 ], [ - 630, 510 ], [ - 690, 500 ],
	[ - 700, 430 ], [ - 690, 360 ], [ - 684, 290 ], [ - 670, 220 ], [ - 648, 180 ],
];
export const HAMLET_PATHS = [
	{ w: 1.15, pts: [ [ - 612, 210 ], [ - 622, 262 ], [ - 628, 318 ], [ - 632, 372 ], [ - 624, 425 ], [ - 648, 470 ] ] },
];
