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
// homes: x, z = centre of the facade at floor level; yaw = direction the facade faces (0 south, -PI/2 west,
//   see Buildings.js frameFns); span = main arch span (m), rise = its height; depth = vault depth into the
//   hill; side = smaller arches beside it: [ offset along the facade (m, + to the facade's right / local x),
//   span, rise ]; terrace = paved depth in front; skylights = count; seam = the pale blue technology line
//   around the door arch; floor = optional floor height (default: the natural ground at the facade).
export const HOMES = [
	// ---- hillside A, row 1 (~14 m above the lake), just above the green
	{ id: 'A1a', x: 297, z: - 336, yaw: 0.06, span: 7.6, rise: 4.0, depth: 9, side: [ [ 7.2, 4.4, 2.8 ] ], terrace: 5.5, skylights: 2, seam: true },
	{ id: 'A1b', x: 324, z: - 338, yaw: - 0.02, span: 8.6, rise: 4.4, depth: 10, side: [ [ - 7.6, 4.2, 2.7 ], [ 7.8, 4.6, 2.9 ] ], terrace: 6, skylights: 3 },
	{ id: 'A1c', x: 352, z: - 340, yaw: 0.04, span: 7.2, rise: 3.9, depth: 9, side: [ [ - 6.8, 4.0, 2.6 ] ], terrace: 5, skylights: 2, seam: true },
	{ id: 'A1d', x: 378, z: - 342, yaw: - 0.08, span: 8.0, rise: 4.2, depth: 9.5, side: [ [ 7.0, 4.2, 2.7 ] ], terrace: 5.5, skylights: 2 },
	{ id: 'A1e', x: 405, z: - 343, yaw: - 0.18, span: 7.0, rise: 3.8, depth: 8.5, side: [], terrace: 5, skylights: 1 },
	// ---- hillside A, row 2 (~22 m), staggered over row 1
	{ id: 'A2a', x: 311, z: - 372, yaw: 0.05, span: 8.2, rise: 4.3, depth: 10, side: [ [ 7.4, 4.4, 2.8 ] ], terrace: 5.5, skylights: 2 },
	{ id: 'A2b', x: 338, z: - 374, yaw: 0.0, span: 7.4, rise: 4.0, depth: 9, side: [ [ - 6.9, 4.0, 2.6 ], [ 6.9, 4.0, 2.6 ] ], terrace: 5, skylights: 2, seam: true },
	{ id: 'A2c', x: 365, z: - 376, yaw: - 0.05, span: 8.8, rise: 4.5, depth: 10, side: [ [ 8.0, 4.6, 2.9 ] ], terrace: 6, skylights: 3 },
	{ id: 'A2d', x: 393, z: - 378, yaw: - 0.1, span: 7.2, rise: 3.9, depth: 9, side: [ [ - 6.8, 4.0, 2.6 ] ], terrace: 5, skylights: 2 },
	{ id: 'A2e', x: 420, z: - 381, yaw: - 0.2, span: 7.6, rise: 4.0, depth: 9, side: [], terrace: 5, skylights: 1, seam: true },
	// ---- hillside A, row 3 (~29 m), along the old road bench
	{ id: 'A3a', x: 325, z: - 410, yaw: 0.04, span: 7.4, rise: 4.0, depth: 9, side: [ [ 7.0, 4.2, 2.7 ] ], terrace: 5, skylights: 2 },
	{ id: 'A3b', x: 352, z: - 410, yaw: 0.0, span: 8.4, rise: 4.4, depth: 10, side: [ [ - 7.6, 4.4, 2.8 ] ], terrace: 5.5, skylights: 2, seam: true },
	{ id: 'A3c', x: 380, z: - 412, yaw: - 0.04, span: 7.0, rise: 3.8, depth: 9, side: [ [ 6.6, 4.0, 2.6 ] ], terrace: 5, skylights: 2 },
	{ id: 'A3d', x: 407, z: - 414, yaw: - 0.1, span: 8.0, rise: 4.2, depth: 9.5, side: [], terrace: 5.5, skylights: 2 },
	{ id: 'A3e', x: 434, z: - 418, yaw: - 0.18, span: 7.4, rise: 4.0, depth: 9, side: [ [ - 7.0, 4.2, 2.6 ] ], terrace: 5, skylights: 1 },
	// ---- hillside A west of the stream, facing south-east over the pond
	{ id: 'AWa', x: 226, z: - 356, yaw: 0.38, span: 7.6, rise: 4.0, depth: 9, side: [ [ 7.0, 4.0, 2.6 ] ], terrace: 5.5, skylights: 2, seam: true },
	{ id: 'AWb', x: 238, z: - 392, yaw: 0.3, span: 8.0, rise: 4.2, depth: 9.5, side: [ [ - 7.2, 4.2, 2.7 ] ], terrace: 5, skylights: 2 },
	// ---- hillside B, facing south-west over the gardens and the cove
	{ id: 'B1a', x: 449, z: - 304, yaw: - 0.72, span: 7.6, rise: 4.0, depth: 9, side: [ [ 7.0, 4.0, 2.6 ] ], terrace: 5.5, skylights: 2 },
	{ id: 'B1b', x: 470, z: - 281, yaw: - 0.8, span: 8.2, rise: 4.3, depth: 9.5, side: [ [ - 7.4, 4.2, 2.7 ] ], terrace: 6, skylights: 2, seam: true },
	{ id: 'B1c', x: 490, z: - 257, yaw: - 0.9, span: 7.0, rise: 3.8, depth: 9, side: [], terrace: 5, skylights: 1 },
	{ id: 'B2a', x: 490, z: - 331, yaw: - 0.7, span: 8.0, rise: 4.2, depth: 9.5, side: [ [ 7.2, 4.2, 2.7 ] ], terrace: 5.5, skylights: 2 },
	{ id: 'B2b', x: 514, z: - 307, yaw: - 0.78, span: 7.4, rise: 4.0, depth: 9, side: [ [ - 6.8, 4.0, 2.6 ], [ 6.8, 3.8, 2.5 ] ], terrace: 5, skylights: 2, seam: true },
	{ id: 'B2c', x: 538, z: - 283, yaw: - 0.86, span: 8.4, rise: 4.4, depth: 10, side: [ [ 7.6, 4.4, 2.8 ] ], terrace: 6, skylights: 3 },
	{ id: 'B3a', x: 512, z: - 362, yaw: - 0.6, span: 7.6, rise: 4.0, depth: 9, side: [ [ 7.0, 4.2, 2.6 ] ], terrace: 5, skylights: 2 },
	{ id: 'B3b', x: 538, z: - 340, yaw: - 0.7, span: 8.0, rise: 4.2, depth: 9.5, side: [], terrace: 5.5, skylights: 2, seam: true },
];

// The communal buildings: tall catenary shells of the same stone, between the green and the cove.
// x, z = centre of the base; r = base radius; h = height; yaw = the main arch's facing.
export const TOWERS = [
	{ id: 'T1', x: 346, z: - 283, r: 7.6, h: 25, yaw: 0.15 },
	{ id: 'T2', x: 373, z: - 293, r: 6.4, h: 20, yaw: - 0.2 },
	{ id: 'T3', x: 321, z: - 279, r: 5.4, h: 16.5, yaw: 0.35 },
];
// low arched annexes beside them (earth-home vaults standing free, roofs planted)
export const ANNEXES = [
	{ id: 'T1w', x: 334, z: - 272, yaw: 0.3, span: 6.0, rise: 3.4, depth: 7 },
	{ id: 'T2e', x: 386, z: - 284, yaw: - 0.55, span: 5.6, rise: 3.2, depth: 6.5 },
];
// paved plaza around the communal buildings: polygon (x, z)
export const PLAZA = [ [ 300, - 268 ], [ 330, - 262 ], [ 365, - 266 ], [ 392, - 276 ], [ 394, - 300 ], [ 370, - 308 ], [ 340, - 300 ], [ 312, - 294 ], [ 298, - 284 ] ];

// The village clearing: the tended land the homes stand in (meadows, scattered trees, gardens); the forest
// closes in beyond it (a ragged edge, see Settlement)
export const CLEARING = [
	[ 196, - 252 ], [ 192, - 300 ], [ 186, - 352 ], [ 200, - 405 ], [ 246, - 440 ], [ 300, - 448 ], [ 362, - 450 ], [ 424, - 454 ],
	[ 470, - 440 ], [ 518, - 404 ], [ 566, - 376 ], [ 580, - 330 ], [ 566, - 274 ], [ 534, - 236 ], [ 500, - 206 ], [ 446, - 226 ],
	[ 404, - 244 ], [ 340, - 252 ], [ 280, - 246 ],
];

// The green: an open, gently sloping lawn (polygon), with natural play structures
export const GREEN = [ [ 262, - 320 ], [ 300, - 326 ], [ 345, - 326 ], [ 392, - 322 ], [ 405, - 312 ], [ 398, - 302 ], [ 372, - 310 ], [ 340, - 304 ], [ 306, - 298 ], [ 278, - 292 ], [ 262, - 300 ] ];
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
];
// A small orchard of apple trees in rows beside the gardens (x, z of its centre, rows x cols, spacing, yaw)
export const ORCHARD = { x: 448, z: - 250, rows: 3, cols: 4, spacing: 6.5, yaw: - 0.6 };

export const PERGOLAS = [
	{ x: 432, z: - 308, yaw: - 0.55, len: 9, w: 2.6 },
	{ x: 398, z: - 288, yaw: - 0.35, len: 7, w: 2.4 },
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

// Paths: polylines (x, z) with half widths. Stairs are built where a path climbs steeper than ~1 in 7.
export const PATHS = [
	// along the shore of the cove, from the stream mouth past the plaza to the dock and on east
	{ w: 1.3, pave: true, pts: [ [ 236, - 262 ], [ 258, - 258 ], [ 276, - 252 ], [ 300, - 258 ], [ 330, - 257 ], [ 362, - 259 ], [ 390, - 256 ], [ 401, - 252 ], [ 425, - 244 ], [ 448, - 232 ], [ 472, - 222 ], [ 498, - 214 ] ] },
	// around the green
	{ w: 1.0, pts: [ [ 258, - 287 ], [ 278, - 290 ], [ 306, - 296 ], [ 340, - 302 ], [ 372, - 308 ], [ 398, - 300 ] ] },
	{ w: 1.0, pts: [ [ 262, - 324 ], [ 300, - 328 ], [ 345, - 329 ], [ 392, - 326 ], [ 410, - 314 ], [ 412, - 296 ] ] },
	// the row walks in front of the terraces
	{ w: 1.1, pts: [ [ 269, - 356 ], [ 286, - 345 ], [ 310, - 344 ], [ 338, - 346 ], [ 366, - 348 ], [ 392, - 350 ], [ 418, - 351 ] ] },
	{ w: 1.1, pts: [ [ 289, - 405 ], [ 300, - 380 ], [ 324, - 380 ], [ 352, - 382 ], [ 380, - 384 ], [ 407, - 387 ], [ 434, - 390 ] ] },
	{ w: 1.1, pts: [ [ 312, - 418 ], [ 340, - 418 ], [ 366, - 419 ], [ 394, - 421 ], [ 421, - 424 ], [ 448, - 428 ] ] },
	// stairs up hillside A (green -> row 1 -> row 2 -> row 3)
	{ w: 1.0, pts: [ [ 311, - 328 ], [ 311, - 344 ] ] },
	{ w: 1.0, pts: [ [ 352, - 348 ], [ 351, - 366 ], [ 352, - 382 ] ] },
	{ w: 1.0, pts: [ [ 394, - 350 ], [ 395, - 368 ], [ 394, - 386 ] ] },
	{ w: 1.0, pts: [ [ 338, - 382 ], [ 339, - 400 ], [ 339, - 418 ] ] },
	{ w: 1.0, pts: [ [ 421, - 390 ], [ 421, - 408 ], [ 421, - 424 ] ] },
	// west of the stream: the pond, the two homes there
	{ w: 1.0, pts: [ [ 258, - 287 ], [ 240, - 290 ], [ 219, - 298 ], [ 208, - 316 ], [ 213, - 336 ], [ 232, - 347 ], [ 252, - 352 ], [ 269, - 356 ] ] },
	{ w: 0.9, pts: [ [ 213, - 336 ], [ 220, - 362 ], [ 236, - 382 ], [ 262, - 396 ], [ 289, - 405 ] ] },
	// the plaza to the gardens and up hillside B
	{ w: 1.1, pts: [ [ 392, - 276 ], [ 404, - 286 ], [ 418, - 300 ], [ 436, - 312 ], [ 446, - 296 ], [ 462, - 276 ], [ 484, - 252 ], [ 498, - 214 ] ] },
	{ w: 1.0, pts: [ [ 436, - 312 ], [ 456, - 326 ], [ 480, - 338 ], [ 500, - 318 ], [ 524, - 296 ], [ 548, - 274 ] ] },
	{ w: 1.0, pts: [ [ 480, - 338 ], [ 500, - 368 ], [ 520, - 352 ], [ 546, - 330 ] ] },
	{ w: 1.0, pts: [ [ 418, - 351 ], [ 436, - 340 ], [ 456, - 326 ] ] },
	// the dock
	{ w: 1.0, pave: true, pts: [ [ 401, - 252 ], [ 400, - 247 ] ] },
];

// Glacial erratics: big lichened granite boulders left among the homes and the meadows (x, z, radius)
export const ERRATICS = [
	[ 262, - 314, 2.2 ], [ 284, - 346, 1.6 ], [ 233, - 330, 1.8 ], [ 455, - 336, 2.4 ], [ 410, - 330, 1.4 ], [ 300, - 392, 2.0 ],
	[ 372, - 396, 1.5 ], [ 452, - 404, 2.6 ], [ 528, - 322, 1.8 ], [ 470, - 300, 1.3 ], [ 214, - 300, 2.0 ], [ 287, - 270, 1.4 ],
	[ 410, - 260, 1.6 ], [ 250, - 380, 1.7 ], [ 500, - 290, 1.5 ], [ 328, - 360, 1.2 ], [ 562, - 300, 2.2 ], [ 448, - 260, 1.4 ],
];

// Designed vistas: corridors kept free of trees (half-width w, metres), from where you first stand
// (WORLD.start, above the first rows) down to each of the halls
export const VISTAS = [
	{ from: [ 290, - 400 ], to: [ 346, - 283 ], w: 10 },
	{ from: [ 290, - 400 ], to: [ 373, - 293 ], w: 9 },
	{ from: [ 290, - 400 ], to: [ 321, - 279 ], w: 8 },
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
	{ id: 'H1', x: - 626, z: 205, yaw: 1.45, span: 7.2, rise: 3.9, depth: 8.5, side: [ [ 6.8, 4.0, 2.6 ] ], terrace: 4.5, skylights: 1, seam: true },
	{ id: 'H2', x: - 640, z: 262, yaw: 1.62, span: 7.8, rise: 4.1, depth: 9, side: [ [ - 7.0, 4.0, 2.6 ] ], terrace: 4.5, skylights: 2 },
	{ id: 'H3', x: - 648, z: 318, yaw: 1.55, span: 7.0, rise: 3.8, depth: 8.5, side: [], terrace: 4.5, skylights: 1 },
	{ id: 'H4', x: - 652, z: 372, yaw: 1.5, span: 8.0, rise: 4.2, depth: 9, side: [ [ 7.2, 4.2, 2.7 ] ], terrace: 5, skylights: 2, seam: true },
	{ id: 'H5', x: - 640, z: 425, yaw: 1.35, span: 7.2, rise: 3.9, depth: 8.5, side: [ [ - 6.8, 4.0, 2.6 ] ], terrace: 4.5, skylights: 1 },
	{ id: 'H6', x: - 668, z: 470, yaw: 1.2, span: 7.6, rise: 4.0, depth: 9, side: [], terrace: 4.5, skylights: 1 },
];
export const HAMLET_CLEARING = [
	[ - 600, 170 ], [ - 578, 240 ], [ - 584, 320 ], [ - 590, 400 ], [ - 596, 460 ], [ - 630, 510 ], [ - 690, 500 ],
	[ - 700, 430 ], [ - 690, 360 ], [ - 684, 290 ], [ - 670, 220 ], [ - 648, 180 ],
];
export const HAMLET_PATHS = [
	{ w: 0.9, pts: [ [ - 612, 210 ], [ - 622, 262 ], [ - 628, 318 ], [ - 632, 372 ], [ - 624, 425 ], [ - 648, 470 ] ] },
];
