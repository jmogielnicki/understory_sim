import { Vector3 } from '../../engine/index.js';
import { gridPart, Part } from '../village/GeoBuilder.js';

// Small craft on the lake (docs/REFERENCE.md: sailboats and a kayak out on the water): two day sailers at
// anchor, a kayak in the cove, a rowboat at the dock. Built into the settlement's builder: hulls of painted
// timber ('wood'), spars ('wood'), sails ('sail': SettlementMaterials.createSailMaterial).
//
// boats: { kind: 'sail' | 'kayak' | 'row', x, z, yaw (bow direction: 0 = +z), len }

// a round-bilged hull: length L, beam B, depth D; local x across, y up (sheer at y = 0.15 * D), z along
// (bow at +L / 2). Returns a Part (outer skin), uv: metres along / around.
function hullPart( L, B, D, sheer = 0.12 ) {

	const N = 18, M = 10;
	return gridPart( N, M, ( i, j ) => {

		const t = i / N * 2 - 1; // -1 stern .. 1 bow
		const half = B / 2 * Math.pow( Math.max( 0, 1 - Math.pow( Math.abs( t ), t > 0 ? 2.2 : 3.5 ) ), 0.5 );
		const depth = D * ( 1 - 0.35 * t * t );
		const a = j / M * Math.PI; // 0 port gunwale .. PI starboard gunwale, through the keel
		const x = - Math.cos( a ) * half;
		const y = - Math.sin( a ) * depth + sheer * D * t * t * 2;
		const z = t * L / 2;
		const nx = - Math.cos( a ), ny = - Math.sin( a ) * ( half / Math.max( depth, 1e-3 ) );
		const l = Math.hypot( nx, ny ) || 1;
		return { p: [ x, y, z ], n: [ nx / l, ny / l, t * 0.2 ], uv: [ z, a * ( B + D ) * 0.5 ] };

	} );

}

// a flat triangular sail between three local points, a little belly toward `belly`
function sailPart( a, b, c, belly ) {

	const N = 6;
	const P = [], NN = [], UV = [], I = [];
	const n = new Vector3().subVectors( b, a ).cross( new Vector3().subVectors( c, a ) ).normalize();
	const idx = ( i, j ) => {

		return i * ( i + 1 ) / 2 + j;

	};

	for ( let i = 0; i <= N; i ++ ) for ( let j = 0; j <= i; j ++ ) {

		// barycentric over the triangle a (head), b (tack), c (clew)
		const u = 1 - i / N, v = i === 0 ? 0 : ( i / N ) * ( 1 - j / i ), w = i === 0 ? 0 : ( i / N ) * ( j / i );
		const p = a.clone().multiplyScalar( u ).addScaledVector( b, v ).addScaledVector( c, w );
		const bulge = 4 * v * w + 2 * u * ( v + w ) * 0.5;
		p.addScaledVector( belly, bulge * 0.35 );
		P.push( p.x, p.y, p.z );
		NN.push( n.x, n.y, n.z );
		UV.push( v, w );

	}

	for ( let i = 0; i < N; i ++ ) for ( let j = 0; j <= i; j ++ ) {

		I.push( idx( i, j ), idx( i + 1, j ), idx( i + 1, j + 1 ) );
		if ( j < i ) I.push( idx( i, j ), idx( i + 1, j + 1 ), idx( i, j + 1 ) );

	}

	return new Part( P, NN, UV, I );

}

const PAINT = { white: [ 0.88, 0.87, 0.82 ], green: [ 0.25, 0.4, 0.3 ], red: [ 0.62, 0.22, 0.16 ], blue: [ 0.2, 0.32, 0.5 ], wood: [ 0.62, 0.45, 0.3 ] };

export function buildBoats( B, boats, rand ) {

	for ( const bt of boats ) {

		B.pushAt( bt.x, 0, bt.z, bt.yaw );
		if ( bt.kind === 'sail' ) {

			const L = bt.len || 6;
			B.part( 'wood', hullPart( L, L * 0.34, 0.75 ), 0, 0.12, 0, { tint: PAINT[ bt.color || 'white' ], data: [ rand.next(), 0.85, 0, 0.2 ] } );
			// deck and cockpit coaming
			B.box( 'wood', 0, 0.16, - 0.2, L * 0.28, 0.05, L * 0.62, { tint: PAINT.wood, data: [ rand.next(), 0, 6, 0.3 ] } );
			// mast, boom
			const mastH = L * 1.25;
			B.rod( 'wood', [ 0, 0.15, L * 0.12 ], [ 0, mastH, L * 0.1 ], 0.06, 0.035, { tint: [ 0.75, 0.62, 0.45 ], data: [ rand.next(), 0, 0, 0.2 ] } );
			const boomEnd = new Vector3( 0.6, 1.0, - L * 0.42 );
			B.rod( 'wood', [ 0, 1.0, L * 0.11 ], [ boomEnd.x, boomEnd.y, boomEnd.z ], 0.045, 0.04, { tint: [ 0.75, 0.62, 0.45 ], data: [ rand.next(), 0, 0, 0.2 ] } );
			// mainsail and jib, eased out a little to starboard
			const head = new Vector3( 0, mastH - 0.2, L * 0.1 );
			B.part( 'sail', sailPart( head, new Vector3( 0, 1.05, L * 0.11 ), boomEnd.clone().add( new Vector3( 0, 0.05, 0 ) ), new Vector3( 1, 0, 0 ) ), 0, 0, 0, { tint: PAINT.white, data: [ rand.next(), 0, 0, 0 ] } );
			B.part( 'sail', sailPart( new Vector3( 0, mastH * 0.82, L * 0.11 ), new Vector3( 0, 0.4, L * 0.47 ), new Vector3( 0.7, 0.5, L * 0.05 ), new Vector3( 1, 0, 0 ) ), 0, 0, 0, { tint: [ 0.92, 0.9, 0.84 ], data: [ rand.next(), 0, 0, 0 ] } );

		} else if ( bt.kind === 'kayak' ) {

			const L = bt.len || 4.2;
			B.part( 'wood', hullPart( L, 0.62, 0.32, 0.25 ), 0, 0.1, 0, { tint: PAINT[ bt.color || 'red' ], data: [ rand.next(), 0.9, 0, 0.1 ] } );
			B.box( 'wood', 0, 0.12, 0, 0.62 * 0.8, 0.03, L * 0.75, { tint: PAINT[ bt.color || 'red' ], data: [ rand.next(), 0.9, 0, 0.1 ] } );
			B.box( 'hard', 0, 0.15, - 0.1, 0.38, 0.05, 0.6, { tint: [ 0.08, 0.08, 0.08 ], data: [ rand.next(), 0, 0, 0 ] } );
			// a paddle laid across
			B.rod( 'wood', [ - 1.1, 0.18, 0.4 ], [ 1.1, 0.18, 0.35 ], 0.015, 0.015, { tint: PAINT.wood, data: [ rand.next(), 0, 0, 0.3 ] } );

		} else {

			const L = bt.len || 3.8;
			B.part( 'wood', hullPart( L, 1.35, 0.5, 0.18 ), 0, 0.2, 0, { tint: PAINT[ bt.color || 'green' ], data: [ rand.next(), 0.7, 5, 0.4 ] } );
			for ( const z of [ - L * 0.25, L * 0.12 ] ) B.box( 'wood', 0, 0.12, z, 1.1, 0.04, 0.24, { tint: PAINT.wood, data: [ rand.next(), 0, 0, 0.5 ] } );
			B.rod( 'wood', [ - 0.4, 0.2, - 0.6 ], [ 0.5, 0.18, 1.2 ], 0.02, 0.02, { tint: PAINT.wood, data: [ rand.next(), 0, 0, 0.5 ] } );

		}

		B.pop();

	}

}
