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
	// from the dock, the communal buildings
	towers: { p: [ 401, 1.7, - 232 ], agl: true, yaw: 0.9, pitch: 0.12, time: 16.5 },
	// the great hall (T1) from its forecourt
	hall: { p: [ 350.5, 1.7, - 256 ], agl: true, yaw: 0.15, pitch: 0.28, time: 15.0 },
	// by the pond, toward the bridge and the homes west of the stream
	pond: { p: [ 254, 1.7, - 298 ], agl: true, yaw: 0.85, pitch: 0.0, time: 16.0 },
	// the village's east edge, toward the woods (birches, pines, the forest floor)
	woodsEdge: { p: [ 470, 1.7, - 360 ], agl: true, yaw: - 1.2, pitch: 0.05, time: 15.0 },
	// the stream coming down past the homes west of it, to the first bridge
	stream: { p: [ 262, 2.2, - 336 ], agl: true, yaw: 0.35, pitch: 0.12, time: 15.5 },
	// the lily pond and its bridge from the bank
	lilies: { p: [ 228, 1.5, - 300 ], agl: true, yaw: - 0.75, pitch: - 0.12, time: 16.5 },
	// the gardens and pergolas below hillside B
	gardens: { p: [ 400, 2.2, - 300 ], agl: true, yaw: - 1.25, pitch: - 0.05, time: 16.0 },
	// dusk over the village: the arches lit
	dusk: { p: [ 330, 3.0, - 296 ], agl: true, yaw: - 0.05, pitch: 0.1, time: 19.6 },
	// the dock and the moored boat from the shore path
	dock: { p: [ 386, 1.7, - 252 ], agl: true, yaw: Math.PI * 0.9, pitch: - 0.05, time: 15.0 },
	// out on the lake by the sailboats, looking back at the north shore
	sailing: { p: [ 340, 2.2, 182 ], yaw: - 0.6, pitch: 0.03, time: 16.0 },
	// across the lake to the hamlet on the point, from the end of the dock
	hamlet: { p: [ 400.5, 1.8, - 212 ], agl: true, yaw: 2.05, pitch: 0.02, time: 17.0 },
	// the hamlet close to, from the water
	hamletNear: { p: [ - 560, 2.5, 330 ], yaw: 1.65, pitch: 0.0, time: 16.0 },
	// key art candidates: down over the homes and the halls to the lake; across the green from hillside B
	keyart: { p: [ 290, 6, - 400 ], agl: true, yaw: - 2.5, pitch: - 0.12, time: 16.5 },
	keyartEast: { p: [ 520, 5, - 330 ], agl: true, yaw: 1.83, pitch: - 0.08, time: 16.5 },
	// the top of the Rattlesnake cliffs (outside the walkable area: the far terrain), looking south
	summit: { p: [ - 140, 30, - 790 ], agl: true, yaw: Math.PI * 0.9, pitch: - 0.18, time: 14.0 },
};

// world position of a view (agl: height above the ground / water at p)
export function viewPosition( app, v ) {

	const p = new Vector3( ...v.p );
	if ( v.agl ) p.y = Math.max( app.terrainData.heightAt( p.x, p.z ), 0 ) + v.p[ 1 ];
	return p;

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
		app.fly.setPose( viewPosition( app, v ), v.yaw, v.pitch );
		app.fly.velocity.set( 0, 0, 0 );
		return name;

	};

}
