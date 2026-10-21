import { Vector3 } from '../../engine/index.js';
import { Part } from '../village/GeoBuilder.js';
import { polylineDistance } from '../terrain/Paths.js';

// The village's built landscape between the homes: stone steps where the paths climb, timber footbridges over
// the stream, pergolas and raised beds in the gardens, log play frames on the green, flagged paving on the
// halls' aprons and the lakeshore walk, and the dock. Builder keys as in EarthHome.js ('stone', 'wood', 'hard').

const OAK = [ 0.62, 0.45, 0.3 ];
const GREY_OAK = [ 0.66, 0.6, 0.52 ];
const BARK = [ 0.42, 0.33, 0.25 ];

// Steps: wherever a path climbs steeper than ~1 in 7, dressed stone treads on its smoothed profile
// (risers ~16 cm). Returns the number of steps.
export function buildSteps( B, p, rand, groundAt ) {

	const pts = p.pts;
	let len = 0;
	for ( let k = 0; k < pts.length - 1; k ++ ) len += Math.hypot( pts[ k + 1 ][ 0 ] - pts[ k ][ 0 ], pts[ k + 1 ][ 1 ] - pts[ k ][ 1 ] );
	// position / direction at arc length s
	const at = ( s ) => {

		let acc = 0;
		for ( let k = 0; k < pts.length - 1; k ++ ) {

			const [ ax, az ] = pts[ k ], [ bx, bz ] = pts[ k + 1 ];
			const L = Math.hypot( bx - ax, bz - az );
			if ( s <= acc + L || k === pts.length - 2 ) {

				const t = Math.min( 1, Math.max( 0, ( s - acc ) / L ) );
				return { x: ax + ( bx - ax ) * t, z: az + ( bz - az ) * t, dx: ( bx - ax ) / L, dz: ( bz - az ) / L };

			}

			acc += L;

		}

		return null;

	};

	// the finished ground along the path (after every earthwork), smoothed over a couple of metres
	const prof = { heightAt: ( s ) => {

		let h = 0;
		for ( const d of [ - 1, - 0.5, 0, 0.5, 1 ] ) {

			const c = at( Math.min( len, Math.max( 0, s + d ) ) );
			h += groundAt( c.x, c.z );

		}

		return h / 5;

	} };
	let n = 0;
	const rise = 0.16;
	let s = 0;
	while ( s < len - 0.3 ) {

		const slope = ( prof.heightAt( s + 0.6 ) - prof.heightAt( s - 0.6 ) ) / 1.2;
		if ( Math.abs( slope ) < 0.14 ) {

			s += 0.4;
			continue;

		}

		// one step: tread length so that the step rises `rise` along the smoothed profile
		const tread = Math.min( 0.9, Math.max( 0.32, rise / Math.abs( slope ) ) );
		const c = at( s + tread / 2 );
		const hi = Math.max( prof.heightAt( s ), prof.heightAt( s + tread ) );
		const yaw = Math.atan2( c.dx, c.dz );
		const w = p.w * 2 * ( 0.95 + rand.next() * 0.1 );
		B.box( 'stone', c.x, hi - 0.17, c.z, w, 0.38, tread + 0.06, { ry: yaw + ( rand.next() - 0.5 ) * 0.03, data: [ rand.next(), 3, 0.35, w ] } );
		n ++;
		s += tread;

	}

	return n;

}

// a flagged ribbon along a path (the lakeshore walk), on the ground
export function buildPavedPath( B, p, groundAt ) {

	const pts = p.pts;
	const P = [], N = [], UV = [], I = [];
	let row = 0;
	for ( let k = 0; k < pts.length - 1; k ++ ) {

		const [ ax, az ] = pts[ k ], [ bx, bz ] = pts[ k + 1 ];
		const L = Math.hypot( bx - ax, bz - az );
		const n = Math.max( 1, Math.ceil( L / 0.6 ) );
		const dx = ( bx - ax ) / L, dz = ( bz - az ) / L;
		for ( let q = ( k === 0 ? 0 : 1 ); q <= n; q ++ ) {

			const t = q / n;
			const x = ax + ( bx - ax ) * t, z = az + ( bz - az ) * t;
			for ( const side of [ - 1, 1 ] ) {

				const px = x - dz * side * p.w * 1.05, pz = z + dx * side * p.w * 1.05;
				P.push( px, groundAt( px, pz ) + 0.05, pz );
				N.push( 0, 1, 0 );
				UV.push( px, pz );

			}

			if ( row > 0 ) {

				const a = ( row - 1 ) * 2;
				I.push( a, a + 2, a + 3, a, a + 3, a + 1 );

			}

			row ++;

		}

	}

	B.part( 'stone', new Part( P, N, UV, I ), 0, 0, 0, { data: [ 0.37, 1, 0.5, 0 ] } );

}

// a flagged apron round a hall's foot: a polar ring from the wall out to a gently wavering edge
export function buildApron( B, t, groundAt, lift = 0.06 ) {

	const N = 96, M = 8;
	const r0 = t.r * 0.92, P = [], NN = [], UV = [], I = [];
	for ( let i = 0; i <= N; i ++ ) {

		const a = i / N * Math.PI * 2;
		const edge = t.r + 4.2 + Math.sin( a * 3 + t.x ) * 0.8 + Math.sin( a * 7 + t.z ) * 0.35;
		for ( let j = 0; j <= M; j ++ ) {

			const r = r0 + ( edge - r0 ) * j / M;
			const x = t.x + Math.cos( a ) * r, z = t.z + Math.sin( a ) * r;
			P.push( x, groundAt( x, z ) + lift, z );
			NN.push( 0, 1, 0 );
			UV.push( x, z );

		}

	}

	for ( let i = 0; i < N; i ++ ) for ( let j = 0; j < M; j ++ ) {

		const a = i * ( M + 1 ) + j, b = a + M + 1;
		I.push( a, b + 1, a + 1, a, b, b + 1 );

	}

	B.part( 'stone', new Part( P, NN, UV, I ), 0, 0, 0, { data: [ 0.71, 1, 0.45, 0 ] } );

}

// A timber footbridge, arching low over the stream: two curved stringers, deck planks across them, posts and
// a handrail; stone abutments at the ends. Returns walkable collider boxes (world).
export function buildBridge( B, b, groundAt, rand ) {

	const c = Math.cos( b.yaw ), s = Math.sin( b.yaw );
	// span direction: local +x
	const toW = ( lx, lz ) => [ b.x + lx * c + lz * s, b.z - lx * s + lz * c ];
	const L = b.len, half = L / 2, w = 1.5;
	const [ ex0, ez0 ] = toW( - half, 0 ), [ ex1, ez1 ] = toW( half, 0 );
	const y0 = groundAt( ex0, ez0 ) + 0.12, y1 = groundAt( ex1, ez1 ) + 0.12;
	const arch = Math.min( 0.9, L * 0.09 );
	const deckY = ( t ) => y0 + ( y1 - y0 ) * t + arch * 4 * t * ( 1 - t );
	const N = Math.max( 6, Math.round( L / 0.32 ) );
	const colliders = [];
	B.pushAt( b.x, 0, b.z, b.yaw );
	for ( let i = 0; i < N; i ++ ) {

		const t = ( i + 0.5 ) / N;
		const x = - half + L * t;
		const y = deckY( t );
		B.box( 'wood', x, y, 0, L / N - 0.025, 0.06, w, { grain: 2, data: [ rand.next(), 0, 7, 0.55 ], tint: GREY_OAK } );

	}

	for ( const side of [ - 1, 1 ] ) {

		const z = side * ( w / 2 - 0.18 );
		for ( let i = 0; i < 12; i ++ ) {

			const ta = i / 12, tb = ( i + 1 ) / 12;
			B.beam( 'wood', [ - half + L * ta, deckY( ta ) - 0.15, z ], [ - half + L * tb, deckY( tb ) - 0.15, z ], 0.12, 0.22, { extend: 0.02, data: [ rand.next(), 0, 0, 0.5 ], tint: OAK } );

		}

		// posts and the handrail
		const posts = Math.max( 3, Math.round( L / 1.6 ) + 1 );
		let prev = null;
		for ( let k = 0; k < posts; k ++ ) {

			const t = 0.04 + 0.92 * k / ( posts - 1 );
			const x = - half + L * t, y = deckY( t );
			const zz = side * ( w / 2 + 0.03 );
			B.box( 'wood', x, y + 0.48, zz, 0.09, 0.96, 0.09, { data: [ rand.next(), 0, 0, 0.5 ], tint: OAK } );
			const top = [ x, y + 0.98, zz ];
			if ( prev ) B.beam( 'wood', prev, top, 0.07, 0.07, { extend: 0.05, data: [ rand.next(), 0, 0, 0.5 ], tint: GREY_OAK } );
			prev = top;

		}

	}

	// abutments
	for ( const [ x, y ] of [ [ - half - 0.2, y0 ], [ half + 0.2, y1 ] ] ) B.box( 'stone', x, y - 0.35, 0, 0.9, 0.7, w + 0.5, { data: [ rand.next(), 3, 0.6, 0.9 ] } );
	B.pop();
	for ( let i = 0; i < 4; i ++ ) {

		const t = ( i + 0.5 ) / 4;
		const [ x, z ] = toW( - half + L * t, 0 );
		colliders.push( { center: new Vector3( x, deckY( t ) - 0.25, z ), half: new Vector3( L / 8 + 0.1, 0.28, w / 2 ), yaw: b.yaw } );

	}

	return colliders;

}

// pergola: timber posts, beams and rafters over a garden walk (local x along it)
export function buildPergola( B, p, groundAt, rand ) {

	const c = Math.cos( p.yaw ), s = Math.sin( p.yaw );
	const g = groundAt( p.x, p.z );
	const H = 2.6;
	B.pushAt( p.x, g, p.z, p.yaw );
	const n = Math.max( 2, Math.round( p.len / 2.4 ) + 1 );
	for ( let k = 0; k < n; k ++ ) {

		const x = - p.len / 2 + p.len * k / ( n - 1 );
		for ( const side of [ - 1, 1 ] ) {

			const z = side * p.w / 2;
			const lx = x * c + z * s, lz = - x * s + z * c;
			const dy = groundAt( p.x + lx, p.z + lz ) - g;
			B.box( 'wood', x, ( dy + H ) / 2 - 0.1, z, 0.14, H - dy + 0.2, 0.14, { data: [ rand.next(), 0, 0, 0.6 ], tint: GREY_OAK } );

		}

	}

	for ( const side of [ - 1, 1 ] ) B.box( 'wood', 0, H + 0.08, side * p.w / 2, p.len + 0.6, 0.18, 0.1, { data: [ rand.next(), 0, 0, 0.6 ], tint: GREY_OAK } );
	const r = Math.round( p.len / 0.55 );
	for ( let k = 0; k <= r; k ++ ) B.box( 'wood', - p.len / 2 - 0.2 + ( p.len + 0.4 ) * k / r, H + 0.25, 0, 0.06, 0.12, p.w + 0.5, { data: [ rand.next(), 0, 0, 0.6 ], tint: GREY_OAK } );
	B.pop();

}

// raised beds: timber frames filled with dark soil, in a grid (rows along local z, cols along x)
export function buildGarden( B, gd, groundAt, rand ) {

	const [ bw, bl ] = gd.bed;
	const c = Math.cos( gd.yaw ), s = Math.sin( gd.yaw );
	const beds = [];
	for ( let r = 0; r < gd.rows; r ++ ) for ( let q = 0; q < gd.cols; q ++ ) {

		const lx = ( q - ( gd.cols - 1 ) / 2 ) * ( bl + 1.3 ), lz = ( r - ( gd.rows - 1 ) / 2 ) * ( bw + 1.1 );
		const x = gd.x + lx * c + lz * s, z = gd.z - lx * s + lz * c;
		let g = Infinity;
		for ( const [ a, b ] of [ [ - bl / 2, - bw / 2 ], [ bl / 2, - bw / 2 ], [ - bl / 2, bw / 2 ], [ bl / 2, bw / 2 ] ] ) g = Math.min( g, groundAt( x + a * c + b * s, z - a * s + b * c ) );
		const top = g + 0.45;
		B.pushAt( x, 0, z, gd.yaw );
		for ( const side of [ - 1, 1 ] ) {

			B.box( 'wood', 0, top - 0.25, side * ( bw / 2 - 0.03 ), bl, 0.6, 0.06, { data: [ rand.next(), 0, 6, 0.5 ], tint: OAK } );
			B.box( 'wood', side * ( bl / 2 - 0.03 ), top - 0.25, 0, 0.06, 0.6, bw - 0.12, { data: [ rand.next(), 0, 6, 0.5 ], tint: OAK } );

		}

		B.box( 'stone', 0, top - 0.06, 0, bl - 0.1, 0.1, bw - 0.1, { data: [ rand.next(), 4, 0, 0 ] } );
		B.pop();
		beds.push( { x, z, yaw: gd.yaw, w: bw - 0.15, l: bl - 0.15, y: top - 0.01 } );

	}

	return beds;

}

// natural play: an A-frame of logs with a climbing log across, or a long balance log on stumps
export function buildPlay( B, p, groundAt, rand ) {

	const g = groundAt( p.x, p.z );
	const bark = { data: [ rand.next(), 0, 5, 0.75 ], tint: BARK, segs: 9 };
	B.pushAt( p.x, g, p.z, p.yaw );
	if ( p.kind === 'logFrame' ) {

		const L = 4.2, H = 2.3;
		for ( const x of [ - L / 2, L / 2 ] ) {

			B.rod( 'wood', [ x - 0.2, - 0.2, - 1.3 ], [ x, H, 0 ], 0.13, 0.11, bark );
			B.rod( 'wood', [ x + 0.2, - 0.2, 1.3 ], [ x, H, 0 ], 0.13, 0.11, bark );

		}

		B.rod( 'wood', [ - L / 2 - 0.3, H - 0.05, 0 ], [ L / 2 + 0.3, H - 0.05, 0 ], 0.15, 0.14, bark );
		for ( let k = 0; k < 4; k ++ ) {

			const y = 0.45 + k * 0.45;
			const zz = - 1.3 * ( 1 - y / H );
			B.rod( 'wood', [ - L / 2, y, zz ], [ L / 2, y, zz ], 0.06, 0.06, bark );

		}

	} else if ( p.kind === 'balanceLog' ) {

		const L = p.len || 6;
		for ( const x of [ - L * 0.35, L * 0.35 ] ) B.rod( 'wood', [ x, - 0.2, 0 ], [ x, 0.32, 0 ], 0.2, 0.2, bark );
		B.rod( 'wood', [ - L / 2, 0.52, 0 ], [ L / 2, 0.48, 0 ], 0.2, 0.17, { ...bark, segs: 11 } );

	}

	B.pop();

}

// The dock: grey timber deck on posts from the bank into ~2.5 m of water, a wider head at the end.
// Returns walkable collider boxes.
export function buildDock( B, d, groundAt, rand ) {

	const y = d.deck;
	const colliders = [];
	const boards = ( x0, x1, z0, z1, across ) => {

		const n = Math.round( ( across ? x1 - x0 : z1 - z0 ) / 0.16 );
		for ( let k = 0; k < n; k ++ ) {

			if ( across ) {

				const x = x0 + ( x1 - x0 ) * ( k + 0.5 ) / n;
				B.box( 'wood', x, y - 0.03, ( z0 + z1 ) / 2, ( x1 - x0 ) / n - 0.015, 0.05, z1 - z0, { grain: 2, data: [ rand.next(), 0, 7, 0.7 ], tint: GREY_OAK } );

			} else {

				const z = z0 + ( z1 - z0 ) * ( k + 0.5 ) / n;
				B.box( 'wood', ( x0 + x1 ) / 2, y - 0.03, z, x1 - x0, 0.05, ( z1 - z0 ) / n - 0.015, { grain: 0, data: [ rand.next(), 0, 7, 0.7 ], tint: GREY_OAK } );

			}

		}

	};

	const hw = d.width / 2;
	const zHead = d.zEnd + d.headDepth;
	boards( d.x - hw, d.x + hw, d.zStart, zHead, false );
	boards( d.x - d.headWidth / 2, d.x + d.headWidth / 2, d.zEnd, zHead, true );
	const post = ( x, z ) => {

		const g = groundAt( x, z );
		B.cyl( 'wood', x, g - 0.3, z, 0.09, 0.1, y - g + 0.25, { data: [ rand.next(), 0, 5, 0.8 ], tint: GREY_OAK, segs: 8 } );

	};

	for ( let z = d.zStart + 1; z < zHead; z += 2.2 ) {

		post( d.x - hw + 0.1, z );
		post( d.x + hw - 0.1, z );

	}

	for ( const x of [ d.x - d.headWidth / 2 + 0.1, d.x, d.x + d.headWidth / 2 - 0.1 ] ) post( x, zHead - 0.1 );
	// stringers under the boards
	for ( const x of [ d.x - hw + 0.12, d.x + hw - 0.12 ] ) B.box( 'wood', x, y - 0.14, ( d.zStart + zHead ) / 2, 0.1, 0.18, zHead - d.zStart, { data: [ rand.next(), 0, 0, 0.7 ], tint: GREY_OAK } );
	colliders.push( { center: new Vector3( d.x, y - 0.2, ( d.zStart + zHead ) / 2 ), half: new Vector3( hw, 0.2, ( zHead - d.zStart ) / 2 ), yaw: 0 } );
	colliders.push( { center: new Vector3( d.x, y - 0.2, ( d.zEnd + zHead ) / 2 ), half: new Vector3( d.headWidth / 2, 0.2, d.headDepth / 2 ), yaw: 0 } );
	return colliders;

}

// Low stone lamps along a path, every ~`every` metres on alternate sides: a dressed post with a warm glowing
// cap. Returns the light positions (world).
export function buildPathLights( B, p, groundAt, rand, every = 16 ) {

	const out = [];
	const pts = p.pts;
	let acc = every * 0.5, side = 1;
	for ( let k = 0; k < pts.length - 1; k ++ ) {

		const [ ax, az ] = pts[ k ], [ bx, bz ] = pts[ k + 1 ];
		const L = Math.hypot( bx - ax, bz - az );
		const dx = ( bx - ax ) / L, dz = ( bz - az ) / L;
		while ( acc < L ) {

			const x = ax + dx * acc - dz * side * ( p.w + 0.55 ), z = az + dz * acc + dx * side * ( p.w + 0.55 );
			const g = groundAt( x, z );
			const yaw = Math.atan2( dx, dz );
			B.box( 'stone', x, g + 0.3, z, 0.2, 0.75, 0.2, { ry: yaw, data: [ rand.next(), 3, 0.5, 0.2 ] } );
			B.box( 'glow', x, g + 0.69, z, 0.14, 0.05, 0.14, { ry: yaw, data: [ rand.next(), 1, 0, 0 ], tint: [ 1.0, 0.72, 0.42 ] } );
			B.box( 'stone', x, g + 0.75, z, 0.26, 0.06, 0.26, { ry: yaw, data: [ rand.next(), 3, 0.5, 0.26 ] } );
			out.push( new Vector3( x, g + 0.7, z ) );
			side = - side;
			acc += every * ( 0.85 + rand.next() * 0.3 );

		}

		acc -= L;

	}

	return out;

}

// distance from (x, z) to the nearest path of a list
export function nearestPath( paths, x, z ) {

	let best = Infinity;
	for ( const p of paths ) best = Math.min( best, polylineDistance( p.pts, x, z )[ 0 ] - p.w );
	return best;

}
