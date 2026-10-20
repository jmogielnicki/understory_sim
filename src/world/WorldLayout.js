import * as THREE from '../engine/index.js';

// Shared world layout. Coordinates in metres, x east, z south, y up; y = 0 is the surface of Squam Lake.
// The world origin lies 650 m south and 150 m east of 43°46'40.49"N 71°32'30.87"W (see
// tools/terrain/build_terrain.py): Rattlesnake Mountain rises to the north (-z), the open lake and its
// islands lie to the south (+z). The village sits on the south-facing slope above a sheltered cove on the
// north shore. Sun rises in the east (+x) and sets in the west (-x).
export const WORLD = {
	terrainSize: 2048, // near (detailed) terrain domain, centred at the origin
	terrainRes: 2048,

	// the cove below the village: its head (the shore) is near z = -245 between x = 320 and 420
	cove: { center: new THREE.Vector3( 370, 0, - 195 ), radius: 70 },

	// the village dock, out from the cove head into ~3 m of water
	pier: {
		x: 400,
		zStart: - 252, // on the bank
		zEnd: - 205, // end of the dock (~3 m deep)
		deckHeight: 0.75, // deck surface above the lake
		width: 1.8,
		headWidth: 7, // T-shaped platform at the end
		headDepth: 3.6,
	},

	// where the boat is moored: east side of the dock head, bow pointing south
	boatDock: { position: new THREE.Vector3( 405.5, 0, - 206 ), heading: 0 },

	village: { center: new THREE.Vector3( 450, 0, - 340 ), radius: 120 },

	// (no reef in the lake: kept far away for the systems that still ask)
	reef: { center: new THREE.Vector3( 1e5, 0, 1e5 ), radius: 1 },

	beach: { xMin: 300, xMax: 420 },

	spawn: { position: new THREE.Vector3( 420, 0, - 270 ), yaw: Math.PI },
	// where the player starts: on the slope above the cove, looking south over the lake
	start: { position: new THREE.Vector3( 430, 0, - 300 ), yaw: Math.PI },

	// prevailing direction the (small) waves travel: north-westerlies blow down the lake toward the south-east
	swellDir: new THREE.Vector2( 0.35, 1 ).normalize(),
};
