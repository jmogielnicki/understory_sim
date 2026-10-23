import { Vector3 } from '../engine/math/index.js';

// Named review cameras used to check every change from the same set of angles.
// window.__view( name ) jumps there; window.__views lists them.
// Named camera views for reference shots (?bench&shots=…, core/Bench.js) and the console (__view( name )).
// p: position; with agl: true, p[ 1 ] is the height above the ground (or the lake surface) at p.
// yaw 0 looks north (-z), PI south (+z), PI / 2 west; time: solar hours.
export const VIEWS = {
	// over the lake looking north at Rattlesnake and the village slope
	aerial: { p: [ 380, 160, 700 ], yaw: 0.05, pitch: - 0.22, time: 15.0 },
	// high above the village looking south down the lake to the islands
	aerialSouth: { p: [ 450, 230, - 700 ], yaw: Math.PI, pitch: - 0.28, time: 10.5 },
	// on the village slope, looking south over the cove
	villageSlope: { p: [ 430, 1.7, - 320 ], agl: true, yaw: Math.PI, pitch: - 0.04, time: 16.0 },
	// at the cove's edge, eye level, looking out of the cove
	cove: { p: [ 366, 1.7, - 249 ], agl: true, yaw: Math.PI * 0.95, pitch: - 0.03, time: 9.5 },
	// low over the open lake, looking back north at the shore and Rattlesnake
	lakeNorth: { p: [ 250, 2.0, 450 ], yaw: 0.1, pitch: 0.02, time: 16.5 },
	// low over the lake looking south-east toward Red Hill
	lakeEast: { p: [ 200, 2.0, 200 ], yaw: - 2.2, pitch: 0.0, time: 11.0 },
	// low over the lake into the evening sun (the Squam Range in the west)
	sunset: { p: [ 300, 2.0, 300 ], yaw: 1.75, pitch: 0.03, time: 18.6 },
	// in the forest on the peninsula
	forest: { p: [ 40, 1.7, - 40 ], agl: true, yaw: 2.4, pitch: 0.0, time: 13.0 },
	// under water off the cove
	underwater: { p: [ 330, - 2.0, - 160 ], yaw: Math.PI * 0.8, pitch: - 0.1, time: 13.0 },
	// the shallows from above
	shallows: { p: [ 390, 3.0, - 230 ], yaw: Math.PI, pitch: - 0.6, time: 12.0 },
	// the village from over the cove, looking up the hillsides
	villageAerial: { p: [ 375, 62, - 170 ], yaw: - 0.05, pitch: - 0.32, time: 15.5 },
	// the layout view: from the hill above the village, out over it to the lake and the islands
	villageLayout: { p: [ 400, 105, - 560 ], yaw: Math.PI + 0.12, pitch: - 0.36, time: 15.5 },
	// on the green, looking up at the first rows of homes
	green: { p: [ 330, 1.7, - 304 ], agl: true, yaw: - 0.15, pitch: 0.06, time: 16.0 },
	// in front of a home (A1b), its terrace and arches
	homeFront: { p: [ 321, 1.7, - 318 ], agl: true, yaw: 0.08, pitch: 0.08, time: 15.5 },
	// on a terrace (A1b), close to its arches
	homeClose: { p: [ 324, 1.6, - 333.5 ], agl: true, yaw: 0.0, pitch: 0.05, time: 15.5 },
	// Mimi's house (A1b, reference/home-v2.png) from below its terrace; its great arch close to
	mimi: { p: [ 331, 1.7, - 318 ], agl: true, yaw: 0.3, pitch: 0.06, time: 16.0 },
	mimiHero: { p: [ 315, 3.4, - 324 ], agl: true, yaw: - 0.42, pitch: - 0.08, time: 16.5 },
	mimiGarden: { p: [ 309, 2.2, - 318 ], agl: true, yaw: - 0.35, pitch: - 0.08, time: 16.0 },
	mimiArch: { p: [ 333.5, 1.6, - 327.5 ], agl: true, yaw: 0.15, pitch: 0.12, time: 16.0 },
	// the neighbourhood as in reference/neighborhood-v2.png: from the hillside west of the rows, over the
	// terraces, the stream and the green to the lake
	neighborhood: { p: [ 282, 12, - 384 ], agl: true, yaw: - 2.45, pitch: - 0.2, time: 16.5 },
	// the festival ground on the green, looking up at the first rows
	festival: { p: [ 352, 1.7, - 262 ], agl: true, yaw: 0.25, pitch: 0.1, time: 14.0 },
	// by the pond, toward the bridge and the homes west of the stream
	pond: { p: [ 254, 1.7, - 298 ], agl: true, yaw: 0.85, pitch: 0.0, time: 16.0 },
	// the village's east edge, toward the woods (birches, pines, the forest floor)
	woodsEdge: { p: [ 470, 1.7, - 360 ], agl: true, yaw: - 1.2, pitch: 0.05, time: 15.0 },
	// along the stream below the first bridge, looking up it
	brook: { p: [ 292, 12, - 396 ], agl: true, yaw: 2.66, pitch: - 0.42, time: 15.0 },
	// beside the stream as it tumbles down past the first bridge
	brookNear: { p: [ 263, 1.6, - 374 ], agl: true, yaw: - 2.5, pitch: - 0.25, time: 15.0 },
	// a row of terraces from above and in front: tables, chairs, pots
	terraces: { p: [ 352, 9, - 318 ], agl: true, yaw: 0.0, pitch: - 0.3, time: 15.5 },
	// the stream coming down past the homes west of it, to the first bridge
	stream: { p: [ 262, 2.2, - 336 ], agl: true, yaw: 0.35, pitch: 0.12, time: 15.5 },
	// the lily pond and its bridge from the bank
	lilies: { p: [ 228, 1.5, - 300 ], agl: true, yaw: - 0.75, pitch: - 0.12, time: 16.5 },
	// the gardens and pergolas below hillside B
	gardens: { p: [ 400, 2.2, - 300 ], agl: true, yaw: - 1.25, pitch: - 0.05, time: 16.0 },
	// the pergola walk and the orchard beyond
	orchard: { p: [ 472, 3.0, - 276 ], agl: true, yaw: 2.42, pitch: - 0.12, time: 15.5 },
	// dusk over the village: the arches lit
	dusk: { p: [ 334, 2.5, - 300 ], agl: true, yaw: 0.05, pitch: 0.06, time: 19.8 },
	// the dock and the moored boat from the shore path
	dock: { p: [ 400.5, 1.7, - 247 ], agl: true, yaw: Math.PI, pitch: - 0.05, time: 15.0 },
	// the launch at the dock, from the water off its starboard quarter
	boatSide: { p: [ 413, 2.4, - 214 ], yaw: 2.3, pitch: - 0.14, time: 15.5 },
	// out on the lake by the sailboats, looking back at the north shore
	sailing: { p: [ 340, 2.2, 182 ], yaw: - 0.6, pitch: 0.03, time: 16.0 },
	// across the lake to the hamlet on the point, from the end of the dock
	hamlet: { p: [ 400.5, 1.8, - 212 ], agl: true, yaw: 2.05, pitch: 0.02, time: 17.0 },
	// the gardens west of the green, toward the pond
	westGardens: { p: [ 299, 3.2, - 259 ], agl: true, yaw: 1.13, pitch: - 0.14, time: 16.0 },
	// the meadow on the slope between rows 1 and 2, looking east along it with the sun behind
	meadow: { p: [ 330, 1.5, - 357 ], agl: true, yaw: - 1.45, pitch: - 0.12, time: 16.0 },
	// the top row of hillside A from the walk behind row 3
	row4: { p: [ 380, 1.7, - 427 ], agl: true, yaw: 0.1, pitch: 0.08, time: 15.5 },
	// hillside B's upper rows from the gardens' side
	hillB: { p: [ 488, 2.0, - 352 ], agl: true, yaw: - 1.7, pitch: 0.06, time: 16.0 },
	// a loon (the first of the wildlife's), seen from a few metres off on the water: p is the offset from it
	loon: { follow: 'loon', p: [ 3.6, 0.55, 0.9 ], pitch: - 0.1, time: 16.0 },
	loonPair: { follow: 'loon', p: [ 8, 1.4, 6 ], pitch: - 0.1, time: 16.0 },
	// the hamlet close to, from the water
	hamletNear: { p: [ - 560, 2.5, 330 ], yaw: 1.65, pitch: 0.0, time: 16.0 },
	// key art candidates: down over the homes and the green to the lake; across the green from hillside B
	keyart: { p: [ 290, 6, - 400 ], agl: true, yaw: - 2.5, pitch: - 0.12, time: 16.5 },
	keyartEast: { p: [ 520, 5, - 330 ], agl: true, yaw: 1.83, pitch: - 0.08, time: 16.5 },
	// the top of the Rattlesnake cliffs (outside the walkable area: the far terrain), looking south
	summit: { p: [ - 140, 30, - 790 ], agl: true, yaw: Math.PI * 0.9, pitch: - 0.18, time: 14.0 },
};

// world position of a view (agl: height above the ground / water at p)
export function viewPosition( app, v ) {

	const t = followTarget( app, v );
	if ( t ) return new Vector3( t.x + v.p[ 0 ], Math.max( app.terrainData.heightAt( t.x + v.p[ 0 ], t.z + v.p[ 2 ] ), 0 ) + v.p[ 1 ], t.z + v.p[ 2 ] );
	const p = new Vector3( ...v.p );
	if ( v.agl ) p.y = Math.max( app.terrainData.heightAt( p.x, p.z ), 0 ) + v.p[ 1 ];
	return p;

}

// heading of a view: its own, or toward what it follows
export function viewYaw( app, v ) {

	return followTarget( app, v ) ? Math.atan2( v.p[ 0 ], v.p[ 2 ] ) : v.yaw;

}

// follow: 'loon' -> the first visible loon's position (null without the wildlife)
function followTarget( app, v ) {

	if ( v.follow !== 'loon' ) return null;
	const b = app.wildlife && app.wildlife.birds;
	const a = b && b.agents.find( ( a ) => a.kind === 'loon' && a.visible );
	return a ? { x: a.f.x, z: a.f.z } : null;

}

export function installDebugViews( app ) {

	window.__views = Object.keys( VIEWS );
	// the current camera as a VIEWS entry (paste it back as a named view): __pose()
	window.__pose = () => {

		const c = app.camera, e = new Vector3().setFromMatrixColumn( c.matrixWorld, 2 ).negate();
		const r = ( v ) => Math.round( v * 100 ) / 100;
		return JSON.stringify( { p: [ r( c.position.x ), r( c.position.y ), r( c.position.z ) ], yaw: r( Math.atan2( - e.x, - e.z ) ), pitch: r( Math.asin( e.y ) ), time: r( app.settings.timeOfDay ) } );

	};
	window.__view = ( name ) => {

		const v = VIEWS[ name ];
		if ( ! v ) return 'unknown view';
		if ( v.time !== undefined ) app.settings.timeOfDay = v.time;
		if ( app.setFreeCam ) app.setFreeCam( true );
		app.fly.setPose( viewPosition( app, v ), viewYaw( app, v ), v.pitch );
		app.fly.velocity.set( 0, 0, 0 );
		return name;

	};

}
