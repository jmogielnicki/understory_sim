// Lays out the village's homes in small clusters with paths winding between them, and writes
// src/world/settlement/Layout.js (HOMES, LANES, COMMONS, RESIDENTS). Run: node tools/layout/clusters.mjs
// (--png=path also draws the plan, for checking it without the renderer).
//
// A cluster: two to six homes round a little common (a shade tree where their paths meet), on the uphill
// side of it in a loose horseshoe, each turned partly toward the common and partly down the slope, at the
// heights the hill gives them. The clusters are scattered over both hillsides with meadow and trees between.
// The paths: each common, then each home's steps, joined to the nearest path already laid (the shore, the
// green, the bridges) by the cheapest route over the ground: gentle grades are cheap, steep ones dear (they
// become stairs), houses, the stream (but for its bridges), the pond and the gardens impassable; a little
// noise in the cost lets them wander. Mimi's house (Plan.js MIMI) is pinned and gets its own cluster.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { TerrainData } from '../../src/world/TerrainData.js';
import * as PLAN from '../../src/world/settlement/Plan.js';
import { polygonDistance } from '../../src/world/settlement/Grading.js';
import { polylineDistance } from '../../src/world/terrain/Paths.js';
import { homeShape, shapeRand } from '../../src/world/settlement/HomeShape.js';

const T = await TerrainData.load();
const arg = ( k ) => ( process.argv.find( ( a ) => a.startsWith( '--' + k + '=' ) ) || '' ).split( '=' )[ 1 ];

let seed = + ( arg( 'seed' ) || 7 );
const rnd = () => ( ( seed = ( seed * 1664525 + 1013904223 ) >>> 0 ) / 4294967296 );
const range = ( a, b ) => a + ( b - a ) * rnd();
const pick = ( w ) => {

	let t = rnd() * w.reduce( ( a, [ , p ] ) => a + p, 0 );
	for ( const [ v, p ] of w ) if ( ( t -= p ) <= 0 ) return v;
	return w[ w.length - 1 ][ 0 ];

};

// smoothed ground: mean over a disc of ~10 m (the lidar is lumpy at the scale of a house)
const SM = [];
for ( let i = - 3; i <= 3; i ++ ) for ( let j = - 3; j <= 3; j ++ ) if ( i * i + j * j <= 10 ) SM.push( [ i * 3.3, j * 3.3 ] );
const hs = ( x, z ) => SM.reduce( ( s, [ a, b ] ) => s + T.heightAt( x + a, z + b ), 0 ) / SM.length;
const grad = ( x, z ) => [ ( hs( x + 2, z ) - hs( x - 2, z ) ) / 4, ( hs( x, z + 2 ) - hs( x, z - 2 ) ) / 4 ];
// the facing straight down the slope (yaw 0 faces +z; a home's outward direction is ( sin yaw, cos yaw ))
const downhill = ( x, z ) => {

	const [ gx, gz ] = grad( x, z ), l = Math.hypot( gx, gz ) || 1;
	return [ - gx / l, - gz / l ];

};

// ---- keep-outs
const STREAM = PLAN.STREAM.map( ( q ) => [ q.x, q.z ] );
const KEPT = PLAN.MANUAL_PATHS;
function siteClear( px, pz ) {

	if ( polylineDistance( STREAM, px, pz )[ 0 ] < 7 ) return false;
	const P = PLAN.POND;
	if ( Math.hypot( ( px - P.x ) / ( P.rx + 7 ), ( pz - P.z ) / ( P.rz + 7 ) ) < 1 ) return false;
	if ( polygonDistance( PLAN.GREEN, px, pz ) < 3 ) return false;
	if ( polygonDistance( PLAN.CLEARING, px, pz ) > - 7 ) return false;
	for ( const g of PLAN.GARDENS ) if ( Math.hypot( px - g.x, pz - g.z ) < 9 ) return false;
	if ( Math.hypot( px - PLAN.ORCHARD.x, pz - PLAN.ORCHARD.z ) < 16 ) return false;
	for ( const p of PLAN.PERGOLAS ) if ( Math.hypot( px - p.x, pz - p.z ) < p.len / 2 + 2 ) return false;
	for ( const b of PLAN.BRIDGES ) if ( Math.hypot( px - b.x, pz - b.z ) < 8 ) return false;
	for ( const [ x, z ] of PLAN.SKY_FLOWERS ) if ( Math.hypot( px - x, pz - z ) < 6 ) return false;
	for ( const [ x, z, r ] of PLAN.ERRATICS ) if ( Math.hypot( px - x, pz - z ) < r + 2 ) return false;
	for ( const p of KEPT ) if ( polylineDistance( p.pts, px, pz )[ 0 ] < p.w + 2 ) return false;
	return T.heightAt( px, pz ) > 2;

}

// a home's footprint in its own frame: the house, its terrace and the space before its steps, and its
// kitchen garden off the left end
function rect( h ) {

	return { x0: - h.len / 2 - ( h.garden ? h.garden + 1.6 : 0 ), x1: h.len / 2, z0: - h.depth, z1: h.terrace + 2.5 };

}

const toL = ( h, x, z ) => {

	const c = Math.cos( h.yaw ), s = Math.sin( h.yaw ), dx = x - h.x, dz = z - h.z;
	return [ dx * c - dz * s, dx * s + dz * c ];

};
const toW = ( h, lx, lz ) => {

	const c = Math.cos( h.yaw ), s = Math.sin( h.yaw );
	return [ h.x + lx * c + lz * s, h.z - lx * s + lz * c ];

};

function inside( h, x, z, m ) {

	const [ lx, lz ] = toL( h, x, z ), r = rect( h );
	return lx > r.x0 - m && lx < r.x1 + m && lz > r.z0 - m && lz < r.z1 + m;

}

// two footprints closer than m? (a grid of points of each tested in the other)
function overlap( a, b, m ) {

	for ( const [ p, q ] of [ [ a, b ], [ b, a ] ] ) {

		const r = rect( q );
		for ( let i = 0; i <= 6; i ++ ) for ( let j = 0; j <= 6; j ++ ) {

			if ( inside( p, ...toW( q, r.x0 + ( r.x1 - r.x0 ) * i / 6, r.z0 + ( r.z1 - r.z0 ) * j / 6 ), m ) ) return true;

		}

	}

	return false;

}

function homeClear( h ) {

	const r = rect( h );
	for ( let i = 0; i <= 4; i ++ ) for ( let j = 0; j <= 3; j ++ ) {

		if ( ! siteClear( ...toW( h, r.x0 - 1 + ( r.x1 - r.x0 + 2 ) * i / 4, r.z0 - 1 + ( r.z1 - r.z0 + 1 ) * j / 3 ) ) ) return false;

	}

	const [ gx, gz ] = grad( h.x, h.z );
	return Math.hypot( gx, gz ) < 0.42;

}

// ---- the clusters
const MIMI = PLAN.MIMI;
const homes = [ { ...MIMI, cluster: 0 } ];
// the commons: Mimi's beside her, east along the top of the green; the rest scattered (a dart throw on a grid
// over the buildable ground, at least SPACING apart)
const SPACING = + ( arg( 'spacing' ) || 64 );
const hubs = [ { x: 344, z: - 343 } ];
{

	const cand = [];
	for ( let x = 190; x < 610; x += 4 ) for ( let z = - 480; z < - 180; z += 4 ) {

		const px = x + range( - 1.5, 1.5 ), pz = z + range( - 1.5, 1.5 );
		if ( siteClear( px, pz ) && polygonDistance( PLAN.CLEARING, px, pz ) < - 20 && Math.hypot( ...grad( px, pz ) ) < 0.38 ) cand.push( [ px, pz, rnd() ] );

	}

	cand.sort( ( a, b ) => a[ 2 ] - b[ 2 ] );
	for ( const [ x, z ] of cand ) {

		if ( hubs.every( ( q ) => Math.hypot( q.x - x, q.z - z ) > SPACING ) ) hubs.push( { x, z } );

	}

	// then, in the room left between them, pairs and cottages on their own
	for ( const [ x, z ] of cand ) {

		if ( hubs.every( ( q ) => Math.hypot( q.x - x, q.z - z ) > SPACING * ( q.small ? 0.6 : 0.8 ) ) ) hubs.push( { x, z, small: true } );

	}

}

const why = { behind: 0, site: 0, overlap: 0 };
const SIZES = [ [ 3, 0.2 ], [ 4, 0.3 ], [ 5, 0.3 ], [ 6, 0.2 ] ];
const clusters = [];
hubs.forEach( ( H, ci ) => {

	const want = ci === 0 ? 4 : H.small ? pick( [ [ 1, 0.5 ], [ 2, 0.4 ], [ 3, 0.1 ] ] ) : pick( SIZES );
	const members = ci === 0 ? [ homes[ 0 ] ] : [];
	const [ ux, uz ] = downhill( H.x, H.z ).map( ( v ) => - v ); // uphill
	const rx = - uz, rz = ux; // to the right of uphill
	for ( let tries = 0; tries < 1500 && members.length < want; tries ++ ) {

		// anywhere in a blob round the common, wider along the slope than up it
		const len = Math.round( range( 11.5, 16.5 ) * 2 ) / 2, depth = Math.round( range( 8.5, 10 ) * 2 ) / 2, terrace = + range( 4.2, 5.6 ).toFixed( 1 );
		const Rc = 9 + want * 3.5;
		const up = range( - 0.8, 1 ) * Rc, side = range( - 1.1, 1.1 ) * Rc;
		const fx = H.x + up * ux + side * rx, fz = H.z + up * uz + side * rz;
		// facing: down the slope, give or take, and a little toward the common
		const [ dx, dz ] = downhill( fx, fz );
		const tl = Math.hypot( H.x - fx, H.z - fz ) || 1, k = up > 0 ? range( 0, 0.3 ) : 0;
		const yaw = Math.atan2( dx * ( 1 - k ) + ( H.x - fx ) / tl * k, dz * ( 1 - k ) + ( H.z - fz ) / tl * k ) + range( - 0.25, 0.25 );
		const h = { x: + fx.toFixed( 1 ), z: + fz.toFixed( 1 ), yaw: + yaw.toFixed( 2 ), len, depth, terrace, cluster: ci };
		if ( rnd() < 0.22 ) h.garden = Math.round( range( 8, 11 ) );
		// the common in front of the house, or well behind it (clear of the ground cut back round its roof)
		const hz = toL( h, H.x, H.z )[ 1 ];
		if ( hz < 1 && hz > - h.depth - 5 ) {

			why.behind ++; continue;

		}

		if ( ! homeClear( h ) ) {

			why.site ++; continue;

		}

		if ( homes.some( ( q ) => overlap( q, h, q.cluster === ci ? 2.6 : 12 ) ) ) {

			why.overlap ++; continue;

		}

		// nor on the common
		if ( inside( h, H.x, H.z, 3 ) ) continue;
		homes.push( h );
		members.push( h );

	}

	if ( members.length ) clusters.push( { H, members, ci } );

} );

// ---- the paths: a cost grid over the clearing
const GX0 = 180, GZ0 = - 490, CELL = 1.5, NX = Math.ceil( ( 615 - GX0 ) / CELL ), NZ = Math.ceil( ( - 175 - GZ0 ) / CELL );
const N = NX * NZ;
const cx = ( i ) => GX0 + ( i % NX + 0.5 ) * CELL, cz = ( i ) => GZ0 + ( Math.floor( i / NX ) + 0.5 ) * CELL;
const cellAt = ( x, z ) => {

	const i = Math.floor( ( x - GX0 ) / CELL ), j = Math.floor( ( z - GZ0 ) / CELL );
	return i < 0 || j < 0 || i >= NX || j >= NZ ? - 1 : j * NX + i;

};

const height = new Float32Array( N ), block = new Uint8Array( N ), mul = new Float32Array( N );
const noise = ( x, z ) => Math.sin( x * 0.083 + Math.sin( z * 0.051 ) * 2 ) * Math.cos( z * 0.071 + Math.sin( x * 0.043 ) * 2 );
for ( let k = 0; k < N; k ++ ) {

	const x = cx( k ), z = cz( k );
	height[ k ] = T.heightAt( x, z );
	mul[ k ] = 1 + 0.35 * noise( x, z );
	let b = height[ k ] < 1.2 || polygonDistance( PLAN.CLEARING, x, z ) > - 2;
	const P = PLAN.POND;
	if ( Math.hypot( ( x - P.x ) / ( P.rx + 2 ), ( z - P.z ) / ( P.rz + 2 ) ) < 1 ) b = true;
	if ( ! b ) {

		// the stream: only over its bridges
		const [ d, arc ] = polylineDistance( STREAM, x, z );
		if ( d < 4 && ! PLAN.BRIDGES.some( ( q ) => {

			const ax = Math.sin( q.yaw ), az = Math.cos( q.yaw ), lx = ( x - q.x ) * ax + ( z - q.z ) * az, lz = - ( x - q.x ) * az + ( z - q.z ) * ax;
			return Math.abs( lx ) < q.len / 2 + 1 && Math.abs( lz ) < 1.2;

		} ) ) b = true;

	}

	for ( const g of PLAN.GARDENS ) if ( Math.hypot( x - g.x, z - g.z ) < 6 ) b = true;
	if ( Math.hypot( x - PLAN.ORCHARD.x, z - PLAN.ORCHARD.z ) < 12 ) b = true;
	for ( const [ ex, ez, r ] of PLAN.ERRATICS ) if ( Math.hypot( x - ex, z - ez ) < r + 0.8 ) b = true;
	for ( const [ sx, sz ] of PLAN.SKY_FLOWERS ) if ( Math.hypot( x - sx, z - sz ) < 3 ) b = true;
	if ( polygonDistance( PLAN.GREEN, x, z ) < 0 ) mul[ k ] *= 1.4;
	for ( const [ fx, fz ] of PLAN.FESTIVAL.circles ) if ( Math.hypot( x - fx, z - fz ) < 4 ) mul[ k ] *= 2;
	block[ k ] = b ? 1 : 0;

}

// the houses (and their gardens) block; close beside them costs a little more
for ( const h of homes ) {

	const r = rect( h ), R = Math.hypot( r.x1 - r.x0, r.z1 - r.z0 ) / 2 + 6;
	const [ mx, mz ] = toW( h, ( r.x0 + r.x1 ) / 2, ( r.z0 + r.z1 ) / 2 );
	for ( let z = mz - R; z < mz + R; z += CELL ) for ( let x = mx - R; x < mx + R; x += CELL ) {

		const k = cellAt( x, z );
		if ( k < 0 ) continue;
		const [ lx, lz ] = toL( h, cx( k ), cz( k ) );
		const e = Math.max( r.x0 - lx, lx - r.x1, - h.depth - lz, lz - ( h.terrace + 0.6 ) );
		if ( e < 0.7 ) block[ k ] = 1;
		else if ( e < 2.5 ) mul[ k ] *= 1.6;

	}

}

const NB = [ [ 1, 0 ], [ - 1, 0 ], [ 0, 1 ], [ 0, - 1 ], [ 1, 1 ], [ 1, - 1 ], [ - 1, 1 ], [ - 1, - 1 ] ];
function stepCost( a, b, diag ) {

	const L = diag ? CELL * Math.SQRT2 : CELL;
	const s = Math.abs( height[ b ] - height[ a ] ) / L;
	return L * ( 1 + 9 * s * s ) * ( mul[ a ] + mul[ b ] ) / 2;

}

// cheapest route from cell `from` to any cell of the network; returns the cells, from first to last
const inNet = new Uint8Array( N );
const dist = new Float32Array( N ), prev = new Int32Array( N );
function route( from ) {

	dist.fill( Infinity );
	const heap = [ [ 0, from ] ];
	dist[ from ] = 0;
	prev[ from ] = - 1;
	while ( heap.length ) {

		const [ d, k ] = popMin( heap );
		if ( d > dist[ k ] ) continue;
		if ( inNet[ k ] ) {

			const out = [];
			for ( let c = k; c !== - 1; c = prev[ c ] ) out.push( c );
			return { cells: out.reverse(), cost: d };

		}

		const i = k % NX, j = Math.floor( k / NX );
		for ( const [ di, dj ] of NB ) {

			const ii = i + di, jj = j + dj;
			if ( ii < 0 || jj < 0 || ii >= NX || jj >= NZ ) continue;
			const n = jj * NX + ii;
			if ( block[ n ] && ! inNet[ n ] ) continue;
			const nd = d + stepCost( k, n, di && dj );
			if ( nd < dist[ n ] ) {

				dist[ n ] = nd;
				prev[ n ] = k;
				pushHeap( heap, [ nd, n ] );

			}

		}

	}

	return null;

}

function pushHeap( h, v ) {

	h.push( v );
	let i = h.length - 1;
	while ( i > 0 ) {

		const p = ( i - 1 ) >> 1;
		if ( h[ p ][ 0 ] <= h[ i ][ 0 ] ) break;
		[ h[ p ], h[ i ] ] = [ h[ i ], h[ p ] ];
		i = p;

	}

}

function popMin( h ) {

	const top = h[ 0 ], last = h.pop();
	if ( h.length ) {

		h[ 0 ] = last;
		let i = 0;
		for ( ;; ) {

			const l = i * 2 + 1, r = l + 1;
			let m = i;
			if ( l < h.length && h[ l ][ 0 ] < h[ m ][ 0 ] ) m = l;
			if ( r < h.length && h[ r ][ 0 ] < h[ m ][ 0 ] ) m = r;
			if ( m === i ) break;
			[ h[ m ], h[ i ] ] = [ h[ i ], h[ m ] ];
			i = m;

		}

	}

	return top;

}

const mark = ( x, z, r ) => {

	for ( let dz = - r; dz <= r; dz += CELL / 2 ) for ( let dx = - r; dx <= r; dx += CELL / 2 ) {

		if ( dx * dx + dz * dz > r * r ) continue;
		const k = cellAt( x + dx, z + dz );
		if ( k >= 0 ) inNet[ k ] = 1;

	}

};

const markLine = ( pts, r ) => {

	for ( let i = 0; i < pts.length - 1; i ++ ) {

		const [ ax, az ] = pts[ i ], [ bx, bz ] = pts[ i + 1 ], L = Math.hypot( bx - ax, bz - az );
		for ( let t = 0; t <= L; t += CELL / 2 ) mark( ax + ( bx - ax ) * t / L, az + ( bz - az ) * t / L, r );

	}

};

for ( const p of KEPT ) markLine( p.pts, 1.0 );

// cells to a smooth polyline: the corners kept (Douglas-Peucker), then rounded (Chaikin), the ends fixed
function polyline( cells, first ) {

	let pts = cells.map( ( k ) => [ cx( k ), cz( k ) ] );
	if ( first ) pts[ 0 ] = first;
	const simplify = ( a, b ) => {

		let best = 0, bi = - 1;
		const [ ax, az ] = pts[ a ], [ bx, bz ] = pts[ b ], L = Math.hypot( bx - ax, bz - az ) || 1;
		for ( let i = a + 1; i < b; i ++ ) {

			const d = Math.abs( ( pts[ i ][ 0 ] - ax ) * ( bz - az ) - ( pts[ i ][ 1 ] - az ) * ( bx - ax ) ) / L;
			if ( d > best ) {

				best = d; bi = i;

			}

		}

		return best > 1.1 ? [ ...simplify( a, bi ), ...simplify( bi, b ).slice( 1 ) ] : [ pts[ a ], pts[ b ] ];

	};

	pts = pts.length > 2 ? simplify( 0, pts.length - 1 ) : pts;
	for ( let it = 0; it < 2; it ++ ) {

		const out = [ pts[ 0 ] ];
		for ( let i = 0; i < pts.length - 1; i ++ ) {

			const [ ax, az ] = pts[ i ], [ bx, bz ] = pts[ i + 1 ];
			if ( i > 0 ) out.push( [ ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25 ] );
			if ( i < pts.length - 2 ) out.push( [ ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75 ] );

		}

		out.push( pts[ pts.length - 1 ] );
		pts = out;

	}

	return pts.map( ( [ x, z ] ) => [ Math.round( x * 10 ) / 10, Math.round( z * 10 ) / 10 ] );

}

const lanes = [];
const join = ( x, z, w, why ) => {

	const k = cellAt( x, z );
	if ( k < 0 ) return;
	if ( inNet[ k ] ) return;
	const r = route( k );
	if ( ! r ) {

		console.error( 'no route from', why, x.toFixed( 1 ), z.toFixed( 1 ) );
		return;

	}

	const pts = polyline( r.cells, [ x, z ] );
	lanes.push( { w, pts } );
	markLine( pts, 0.8 );

};

// the commons, nearest the network first (each joins what is already laid: the paths branch like desire lines)
{

	const todo = clusters.filter( ( c ) => c.members.length > 1 ).map( ( c ) => c.H );
	// the ends of bridges no path crosses yet
	for ( const b of PLAN.BRIDGES ) {

		const ax = Math.sin( b.yaw ), az = Math.cos( b.yaw ), e = b.len / 2 + 0.8;
		if ( inNet[ cellAt( b.x, b.z ) ] ) continue;
		const A = [ b.x - ax * e, b.z - az * e ], Bq = [ b.x + ax * e, b.z + az * e ];
		lanes.push( { w: 1.15, pts: [ A, [ b.x, b.z ], Bq ].map( ( [ x, z ] ) => [ Math.round( x * 10 ) / 10, Math.round( z * 10 ) / 10 ] ) } );
		todo.push( { x: A[ 0 ], z: A[ 1 ], bridge: true }, { x: Bq[ 0 ], z: Bq[ 1 ], bridge: true } );

	}

	while ( todo.length ) {

		let best = null;
		for ( const H of todo ) {

			const k = cellAt( H.x, H.z );
			if ( inNet[ k ] ) {

				best = { H, r: null };
				break;

			}

			const r = route( k );
			if ( r && ( ! best || r.cost < best.r.cost ) ) best = { H, r };

		}

		if ( ! best ) {

			console.error( 'unreachable commons', todo.length );
			break;

		}

		todo.splice( todo.indexOf( best.H ), 1 );
		if ( best.r ) {

			const pts = polyline( best.r.cells, [ best.H.x, best.H.z ] );
			lanes.push( { w: 1.2, pts } );
			markLine( pts, 0.9 );

		}

		mark( best.H.x, best.H.z, 2.5 );

	}

}

// each home's steps (at its door, below the terrace) to the nearest path
const DOOR = new Map();
for ( const h of homes ) {

	const id = h.id ?? 'tmp';
	const s = homeShape( { ...h, id }, shapeRand( { ...h, id } ) );
	DOOR.set( h, s.openings.find( ( o ) => o.kind === 'door' ).x );

}

for ( const c of clusters ) {

	c.members.sort( ( a, b ) => Math.hypot( a.x - c.H.x, a.z - c.H.z ) - Math.hypot( b.x - c.H.x, b.z - c.H.z ) );

}

// ---- ids (cluster letter + number from the left) and the output
const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
clusters.sort( ( a, b ) => a.ci - b.ci );
clusters.forEach( ( c, n ) => {

	c.name = n < 26 ? L[ n ] : L[ Math.floor( n / 26 ) - 1 ] + L[ n % 26 ];
	c.members.slice().sort( ( a, b ) => a.x - b.x ).forEach( ( h, i ) => {

		if ( ! h.id ) h.id = c.name + ( i + 1 );

	} );

} );

for ( const c of clusters ) for ( const h of c.members ) {

	const dx = DOOR.get( h );
	const [ x, z ] = toW( h, dx, h.terrace + 1.6 );
	join( x, z, 0.95, h.id );

}

// commons: a shade tree beside where the paths meet; a seat under some
const commons = clusters.filter( ( c ) => c.members.length > 1 ).map( ( c ) => {

	const a = rnd() * Math.PI * 2, r = range( 2.6, 3.6 );
	return [ + ( c.H.x + Math.cos( a ) * r ).toFixed( 1 ), + ( c.H.z + Math.sin( a ) * r ).toFixed( 1 ), + range( 0.55, 0.75 ).toFixed( 2 ) ];

} );

// groves in the meadow between the clusters (so each group reads as its own): clumps where a slow noise is
// high, well away from the homes, off the paths, the green and the vistas
const groves = [];
{

	const allPaths = [ ...KEPT, ...lanes ];
	const vista = ( x, z ) => PLAN.VISTAS.some( ( v ) => polylineDistance( [ v.from, v.to ], x, z )[ 0 ] < v.w );
	for ( let x = 192; x < 606; x += 5 ) for ( let z = - 478; z < - 190; z += 5 ) {

		const px = x + range( - 2, 2 ), pz = z + range( - 2, 2 );
		const n = Math.sin( px * 0.045 + Math.sin( pz * 0.031 ) * 2.3 ) * Math.cos( pz * 0.052 - Math.sin( px * 0.027 ) * 1.7 );
		if ( n < 0.2 || rnd() > 0.55 ) continue;
		if ( polygonDistance( PLAN.CLEARING, px, pz ) > - 3 || polygonDistance( PLAN.GREEN, px, pz ) < 4 || vista( px, pz ) ) continue;
		if ( homes.some( ( h ) => inside( h, px, pz, 7 ) ) ) continue;
		if ( allPaths.some( ( p ) => polylineDistance( p.pts, px, pz )[ 0 ] < p.w + 3 ) ) continue;
		if ( polylineDistance( STREAM, px, pz )[ 0 ] < 5 || T.heightAt( px, pz ) < 2 ) continue;
		const P = PLAN.POND;
		if ( Math.hypot( ( px - P.x ) / ( P.rx + 4 ), ( pz - P.z ) / ( P.rz + 4 ) ) < 1 ) continue;
		if ( PLAN.GARDENS.some( ( g ) => Math.hypot( px - g.x, pz - g.z ) < 9 ) || Math.hypot( px - PLAN.ORCHARD.x, pz - PLAN.ORCHARD.z ) < 16 ) continue;
		if ( PLAN.ERRATICS.some( ( [ ex, ez, r ] ) => Math.hypot( px - ex, pz - ez ) < r + 2 ) ) continue;
		if ( commons.some( ( [ cx2, cz2 ] ) => Math.hypot( px - cx2, pz - cz2 ) < 6 ) ) continue;
		groves.push( [ + px.toFixed( 1 ), + pz.toFixed( 1 ), + range( 0.5, 0.85 ).toFixed( 2 ), pick( [ [ 0, 0.35 ], [ 1, 0.35 ], [ 2, 0.3 ] ] ) ] );

	}

}

// the rest of each home: an arch at one end or none, the blue seam now and then, a porch
for ( const h of homes ) {

	if ( h === homes[ 0 ] ) continue;
	h.loggia = rnd() < 0.45 ? ( rnd() < 0.5 ? 'left' : 'right' ) : null;
	if ( rnd() < 0.3 ) h.seam = true;

}

const residents = [ [ MIMI.id, 2.4, 2.8, 0.3 ] ];
for ( const c of clusters.slice( 1 ) ) if ( residents.length < 4 && c.members.length >= 3 && rnd() < 0.6 ) residents.push( [ c.members[ 0 ].id, + range( - 2, 2 ).toFixed( 1 ), 2.4, + range( - 0.3, 0.3 ).toFixed( 1 ) ] );

const fmt = ( o ) => {

	const v = ( x ) => typeof x === 'string' ? `'${ x }'` : typeof x === 'number' ? ( x < 0 ? '- ' + - x : String( x ) ) : Array.isArray( x ) ? `[ ${ x.map( v ).join( ', ' ) } ]` : String( x );
	return Array.isArray( o ) ? v( o ) : '{ ' + Object.entries( o ).map( ( [ k, x ] ) => `${ k }: ${ v( x ) }` ).join( ', ' ) + ' }';

};

const keys = [ 'id', 'x', 'z', 'yaw', 'len', 'depth', 'loggia', 'terrace', 'seam', 'garden' ];
let src = `// Generated by tools/layout/clusters.mjs (seed ${ arg( 'seed' ) || 7 }): rerun it to lay the village out afresh, or
// edit by hand (see Plan.js for what the fields mean). Mimi's house is Plan.js MIMI, pinned.
//
// LAYOUT_HOMES: the homes, cluster by cluster (the letter), each round its common
export const LAYOUT_HOMES = [\n`;
for ( const c of clusters ) {

	src += `\t// ---- ${ c.name }: ${ c.members.length } round ${ c.H.x.toFixed( 0 ) }, ${ c.H.z.toFixed( 0 ) }\n`;
	for ( const h of c.members ) {

		if ( h === homes[ 0 ] ) continue;
		const o = {};
		for ( const k of keys ) if ( h[ k ] !== undefined && h[ k ] !== false ) o[ k ] = h[ k ];
		src += '\t' + fmt( o ) + ',\n';

	}

}

src += `];
// LANES: the paths between the clusters and from each home's steps (to the shore, the green and the bridges)
export const LANES = [\n${ lanes.map( ( p ) => `\t{ w: ${ p.w }, pts: ${ fmt( p.pts ) } },` ).join( '\n' ) }\n];
// COMMONS: a shade tree on each cluster's common: [ x, z, size ]
export const COMMONS = [\n\t${ commons.map( fmt ).join( ', ' ) },\n];
// GROVES: trees in the meadow between the clusters: [ x, z, size, species (0 maple, 1 oak, 2 birch) ]
export const GROVES = [\n\t${ groves.map( fmt ).join( ', ' ) },\n];
// RESIDENTS: people standing on terraces: [ home id, x along the front, out from it, turn (rad) ]
export const RESIDENTS = [ ${ residents.map( fmt ).join( ', ' ) } ];
`;
writeFileSync( new URL( '../../src/world/settlement/Layout.js', import.meta.url ), src );
console.error( why );
console.error( `${ homes.length } homes in ${ clusters.length } clusters (${ clusters.map( ( c ) => c.members.length ).join( ' ' ) }), ${ lanes.length } paths, ${ groves.length } grove trees` );

// ---- the plan, drawn (1 px = 0.5 m)
if ( arg( 'png' ) ) {

	const X0 = 185, Z0 = - 485, W = 850, Hh = 620, S = 0.5;
	const img = new Uint8Array( W * Hh * 3 );
	const set = ( i, j, [ r, g, b ], a = 1 ) => {

		if ( i < 0 || j < 0 || i >= W || j >= Hh ) return;
		const o = ( j * W + i ) * 3;
		img[ o ] = img[ o ] * ( 1 - a ) + r * a; img[ o + 1 ] = img[ o + 1 ] * ( 1 - a ) + g * a; img[ o + 2 ] = img[ o + 2 ] * ( 1 - a ) + b * a;

	};

	for ( let j = 0; j < Hh; j ++ ) for ( let i = 0; i < W; i ++ ) {

		const x = X0 + i * S, z = Z0 + j * S, h = T.heightAt( x, z );
		const shade = Math.max( 0, Math.min( 1, 0.6 + ( T.heightAt( x - 1, z - 1 ) - h ) * 0.8 ) );
		let c = h < 0.3 ? [ 90, 130, 170 ] : polygonDistance( PLAN.CLEARING, x, z ) < 0 ? [ 170, 190, 120 ] : [ 70, 110, 70 ];
		if ( polygonDistance( PLAN.GREEN, x, z ) < 0 ) c = [ 150, 205, 110 ];
		c = c.map( ( v ) => v * shade );
		if ( Math.abs( ( h / 2.5 ) - Math.round( h / 2.5 ) ) < 0.05 && h > 0.3 ) c = c.map( ( v ) => v * 0.8 );
		if ( polylineDistance( STREAM, x, z )[ 0 ] < 1.5 ) c = [ 60, 110, 200 ];
		set( i, j, c );

	}

	const disc = ( x, z, r, col, a = 1 ) => {

		const ci = ( x - X0 ) / S, cj = ( z - Z0 ) / S, R = r / S;
		for ( let j = Math.floor( cj - R ); j <= cj + R; j ++ ) for ( let i = Math.floor( ci - R ); i <= ci + R; i ++ ) if ( ( i - ci ) ** 2 + ( j - cj ) ** 2 <= R * R ) set( i, j, col, a );

	};

	for ( const p of [ ...KEPT, ...lanes ] ) for ( let k = 0; k < p.pts.length - 1; k ++ ) {

		const [ ax, az ] = p.pts[ k ], [ bx, bz ] = p.pts[ k + 1 ], Ln = Math.hypot( bx - ax, bz - az );
		for ( let t = 0; t <= Ln; t += 0.4 ) disc( ax + ( bx - ax ) * t / Ln, az + ( bz - az ) * t / Ln, p.w, [ 200, 170, 120 ] );

	}

	for ( const h of homes ) {

		const r = rect( h );
		for ( let lz = - h.depth; lz < h.terrace; lz += 0.3 ) for ( let lx = r.x0; lx < r.x1; lx += 0.3 ) {

			const [ x, z ] = toW( h, lx, lz );
			const col = lx < - h.len / 2 ? [ 120, 150, 60 ] : lz < 0 ? ( h === homes[ 0 ] ? [ 240, 120, 120 ] : [ 245, 230, 190 ] ) : [ 190, 160, 120 ];
			set( Math.round( ( x - X0 ) / S ), Math.round( ( z - Z0 ) / S ), col );

		}

	}

	for ( const [ x, z ] of [ ...commons, ...groves ] ) disc( x, z, 2.5, [ 30, 80, 30 ] );
	for ( const c of clusters ) disc( c.H.x, c.H.z, 1, [ 220, 40, 40 ] );
	// png
	const raw = Buffer.alloc( ( W * 3 + 1 ) * Hh );
	for ( let j = 0; j < Hh; j ++ ) {

		raw[ j * ( W * 3 + 1 ) ] = 0;
		Buffer.from( img.buffer, j * W * 3, W * 3 ).copy( raw, j * ( W * 3 + 1 ) + 1 );

	}

	const crcT = new Int32Array( 256 ).map( ( _, n ) => {

		let c = n;
		for ( let k = 0; k < 8; k ++ ) c = c & 1 ? 0xedb88320 ^ ( c >>> 1 ) : c >>> 1;
		return c;

	} );
	const chunk = ( type, data ) => {

		const b = Buffer.alloc( data.length + 12 );
		b.writeUInt32BE( data.length, 0 );
		b.write( type, 4 );
		data.copy( b, 8 );
		let c = - 1;
		for ( let i = 4; i < data.length + 8; i ++ ) c = crcT[ ( c ^ b[ i ] ) & 255 ] ^ ( c >>> 8 );
		b.writeInt32BE( ~ c, data.length + 8 );
		return b;

	};

	const ihdr = Buffer.alloc( 13 );
	ihdr.writeUInt32BE( W, 0 ); ihdr.writeUInt32BE( Hh, 4 ); ihdr[ 8 ] = 8; ihdr[ 9 ] = 2;
	writeFileSync( arg( 'png' ), Buffer.concat( [ Buffer.from( [ 137, 80, 78, 71, 13, 10, 26, 10 ] ), chunk( 'IHDR', ihdr ), chunk( 'IDAT', deflateSync( raw ) ), chunk( 'IEND', Buffer.alloc( 0 ) ) ] ) );

}
