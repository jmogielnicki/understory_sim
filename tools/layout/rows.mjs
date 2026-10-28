// Lays the village's rows of homes along the hill's contours (reference/neighborhood-v2.png: homes a few
// metres apart on terraced rows, each row's terrace just above the roofs of the row below) and prints the
// HOMES / ROWS / STAIRS tables for src/world/settlement/Plan.js. Run: node tools/layout/rows.mjs
//
// Each row: a contour of the smoothed ground (the lidar is lumpy at the scale of a house), followed from a
// start point; homes placed along it with gaps between, each facing straight down the smoothed slope, and
// skipped where they would land on the stream, the pond, the green, the gardens or outside the clearing.
import { TerrainData } from '../../src/world/TerrainData.js';
import * as PLAN from '../../src/world/settlement/Plan.js';
import { polygonDistance } from '../../src/world/settlement/Grading.js';
import { polylineDistance } from '../../src/world/terrain/Paths.js';

const T = await TerrainData.load();

// seeded random
let seed = 20261028;
const rnd = () => ( ( seed = ( seed * 1664525 + 1013904223 ) >>> 0 ) / 4294967296 );
const range = ( a, b ) => a + ( b - a ) * rnd();

// smoothed ground: mean over a disc of ~10 m
const SM = [];
for ( let i = - 3; i <= 3; i ++ ) for ( let j = - 3; j <= 3; j ++ ) if ( i * i + j * j <= 10 ) SM.push( [ i * 3.3, j * 3.3 ] );
const hs = ( x, z ) => {

	let s = 0;
	for ( const [ a, b ] of SM ) s += T.heightAt( x + a, z + b );
	return s / SM.length;

};

const grad = ( x, z ) => {

	const e = 2;
	return [ ( hs( x + e, z ) - hs( x - e, z ) ) / ( 2 * e ), ( hs( x, z + e ) - hs( x, z - e ) ) / ( 2 * e ) ];

};

// facing: straight down the slope (yaw 0 faces +z)
const downhillYaw = ( x, z ) => {

	const [ gx, gz ] = grad( x, z );
	return Math.atan2( - gx, - gz );

};

// march along the contour through (x, z) toward +local x (the right seen from the front); the contour may rise
// k metres per metre along the row (a row can climb gently, its walk with it). Returns arc length -> point.
function contour( x, z, maxLen, k = 0 ) {

	const H = hs( x, z );
	const pts = [ [ x, z ] ];
	let px = x, pz = z;
	for ( let s = 1; s < maxLen; s += 1 ) {

		const yaw = downhillYaw( px, pz );
		// local +x in world: ( cos yaw, -sin yaw )
		px += Math.cos( yaw ); pz -= Math.sin( yaw );
		for ( let j = 0; j < 3; j ++ ) {

			const [ gx, gz ] = grad( px, pz );
			const g2 = gx * gx + gz * gz || 1e-6;
			const d = ( hs( px, pz ) - H - k * s ) / g2;
			px -= gx * d; pz -= gz * d;

		}

		pts.push( [ px, pz ] );

	}

	return ( s ) => pts[ Math.max( 0, Math.min( pts.length - 1, Math.round( s ) ) ) ];

}

// the point at height H on the line x = const (searching north from z0)
function onHeight( x, H, z0 = - 300, z1 = - 540 ) {

	let lo = z0, hi = z1;
	for ( let i = 0; i < 40; i ++ ) {

		const m = ( lo + hi ) / 2;
		if ( hs( x, m ) < H ) lo = m;
		else hi = m;

	}

	return [ x, ( lo + hi ) / 2 ];

}

// keep-outs: is a home (front centre x, z, yaw, length, depth, terrace) clear of everything?
const STREAM = PLAN.STREAM.map( ( q ) => [ q.x, q.z ] );
function clear( x, z, yaw, L, D, Tr ) {

	const c = Math.cos( yaw ), s = Math.sin( yaw );
	const pts = [];
	for ( const lx of [ - L / 2 - 1, 0, L / 2 + 1 ] ) for ( const lz of [ Tr + 1, 0, - D ] ) pts.push( [ x + lx * c + lz * s, z - lx * s + lz * c ] );
	for ( const [ px, pz ] of pts ) {

		if ( polylineDistance( STREAM, px, pz )[ 0 ] < 7 ) return false;
		const P = PLAN.POND;
		if ( Math.hypot( ( px - P.x ) / ( P.rx + 7 ), ( pz - P.z ) / ( P.rz + 7 ) ) < 1 ) return false;
		if ( polygonDistance( PLAN.GREEN, px, pz ) < 2 ) return false;
		if ( polygonDistance( PLAN.CLEARING, px, pz ) > - 6 ) return false;
		for ( const g of PLAN.GARDENS ) if ( Math.hypot( px - g.x, pz - g.z ) < 8 ) return false;
		if ( Math.hypot( px - PLAN.ORCHARD.x, pz - PLAN.ORCHARD.z ) < 15 ) return false;
		for ( const p of PLAN.PERGOLAS ) if ( Math.hypot( px - p.x, pz - p.z ) < p.len / 2 + 2 ) return false;
		for ( const b of PLAN.BRIDGES ) if ( Math.hypot( px - b.x, pz - b.z ) < 7 ) return false;
		if ( T.heightAt( px, pz ) < 2 ) return false;

	}

	// not too steep for a terrace
	const [ gx, gz ] = grad( x, z );
	return Math.hypot( gx, gz ) < 0.42;

}

// a row: from (x, z) along its contour for `len` metres (rising k per metre); stop( x, z ) ends it early
function row( name, x, z, len, { k = 0, stop = null, gardenGaps = 0.18 } = {} ) {

	const at = contour( x, z, len + 20, k );
	const out = [];
	let s = 0, prevEnd = - Infinity;
	while ( s < len ) {

		const L = Math.round( range( 12.5, 16 ) * 2 ) / 2;
		const sc = s + L / 2;
		const [ px, pz ] = at( sc );
		if ( stop && stop( px, pz, L ) ) break;
		// facing: square to the row (its direction over ~24 m), so neighbours face out together
		const [ ax, az ] = at( sc - 12 ), [ bx, bz ] = at( sc + 12 );
		const yaw = Math.atan2( - ( bz - az ), bx - ax );
		const D = Math.round( range( 8.5, 10 ) * 2 ) / 2, Tr = Math.round( range( 4.5, 5.5 ) * 10 ) / 10;
		if ( ! clear( px, pz, yaw, L, D, Tr ) || placed.some( ( q ) => q.row !== name && overlap( q, { x: px, z: pz, yaw, len: L, depth: D, terrace: Tr } ) ) ) {

			s += 2;
			continue;

		}

		const h = { x: + px.toFixed( 1 ), z: + pz.toFixed( 1 ), yaw: + yaw.toFixed( 2 ), len: L, depth: D, terrace: Tr, row: name };
		h.gapBefore = sc - L / 2 - prevEnd;
		out.push( h );
		placed.push( h );
		prevEnd = sc + L / 2;
		// the gap to the next: usually a few metres (stairs, a tree), now and then room for a kitchen garden
		s = prevEnd + ( rnd() < gardenGaps ? 13 : range( 5.5, 7.5 ) );

	}

	return { name, homes: out };

}

// footprints (house, terrace and a 1.5 m margin) of two homes intersect? (points of each tested in the other)
function inside( h, x, z, m = 1.5 ) {

	const c = Math.cos( h.yaw ), s = Math.sin( h.yaw ), dx = x - h.x, dz = z - h.z;
	const lx = dx * c - dz * s, lz = dx * s + dz * c;
	return Math.abs( lx ) < h.len / 2 + m && lz > - h.depth - m && lz < h.terrace + m;

}

function overlap( a, b ) {

	for ( const [ p, q ] of [ [ a, b ], [ b, a ] ] ) {

		const c = Math.cos( q.yaw ), s = Math.sin( q.yaw );
		for ( let i = 0; i <= 4; i ++ ) for ( let j = 0; j <= 4; j ++ ) {

			const lx = ( i / 4 - 0.5 ) * q.len, lz = - q.depth + ( q.depth + q.terrace ) * j / 4;
			if ( inside( p, q.x + lx * c + lz * s, q.z - lx * s + lz * c ) ) return true;

		}

	}

	return false;

}
// every home placed so far: a home must keep clear of the homes of other rows (by its footprint: front centre
// to front centre, allowing for the depth of the one behind)
const placed = [];
const overlaps = ( x, z, L ) => placed.some( ( q ) => Math.hypot( q.x - x, q.z - z ) < Math.max( 15, ( q.len + L ) / 2 + 2 ) );

const mimi = PLAN.HOMES.find( ( h ) => h.name === 'Mimi' );
const rows = [];
// ---- hillside A. Row 1 through Mimi's house: west of it up to her kitchen garden's gap, then her house
// (pinned), then on east, climbing gently with the ground above the green
{

	const gardenGap = 13.5;
	const endW = mimi.x - mimi.len / 2 - gardenGap;
	const W = row( 'A1', ...onHeight( 262, hs( mimi.x, mimi.z ) ), 80, { stop: ( x, z, L ) => x + L / 2 > endW } );
	const M = { x: mimi.x, z: mimi.z, yaw: mimi.yaw, len: mimi.len, depth: mimi.depth, terrace: mimi.terrace, row: 'A1', mimi: true };
	placed.push( M );
	const sx = mimi.x + mimi.len / 2 + 6.5;
	// (east of her the ground is higher: this part of the row stands ~2.5 m up, its walk climbing to it)
	const E = row( 'A1', ...onHeight( sx + 6, hs( mimi.x, mimi.z ) + 2.5 ), 110, { k: 0.015 } );
	rows.push( { name: 'A1', homes: [ ...W.homes, M, ...E.homes ] } );

}

// rows 2-6: every ~5.2 m of height, each starting by the stream
const H1 = hs( mimi.x, mimi.z ) + 2.5;
for ( let i = 2; i <= 6; i ++ ) {

	const H = H1 + ( i - 1 ) * 5.2;
	rows.push( row( 'A' + i, ...onHeight( 268 + i * 6, H ), 190, { k: 0.01 } ) );

}

// ---- hillside B: rows facing south-west, from the gardens up
for ( let i = 1; i <= 4; i ++ ) {

	const H = 13.4 + ( i - 1 ) * 5.6;
	const x = 436 + i * 22;
	rows.push( row( 'B' + i, ...onHeight( x, H, - 260, - 420 ), 110 ) );

}

// gaps from the homes as placed (front centres, less the half lengths), and facings eased toward their
// neighbours' (the contours of the lidar still wobble at the scale of a row)
for ( const r of rows ) {

	const H = r.homes;
	H.forEach( ( h, i ) => {

		h.gapBefore = i === 0 ? null : Math.hypot( h.x - H[ i - 1 ].x, h.z - H[ i - 1 ].z ) - ( h.len + H[ i - 1 ].len ) / 2;

	} );
	const y0 = H.map( ( h ) => h.yaw );
	H.forEach( ( h, i ) => {

		if ( h.mimi ) return;
		const a = y0[ Math.max( 0, i - 1 ) ], b = y0[ Math.min( H.length - 1, i + 1 ) ];
		h.yaw = + ( y0[ i ] * 0.4 + ( a + b ) * 0.3 ).toFixed( 2 );

	} );

}

for ( const r of rows ) console.error( r.name, r.homes.length, r.homes.map( ( h ) => `${ h.x },${ h.z } y${ h.yaw }` ).join( ' | ' ) );

// ---- the Plan.js tables
const letters = 'abcdefghijklmnop';
const lines = [];
const rowIds = [];
for ( const r of rows ) {

	const ids = [];
	lines.push( `\t// ---- row ${ r.name }` );
	r.homes.forEach( ( h, i ) => {

		const id = r.name + letters[ i ];
		ids.push( id );
		if ( h.mimi ) {

			const { id: _, ...rest } = mimi;
			lines.push( '\t' + fmt( { id, ...rest } ) + ',' );
			return;

		}

		const o = { id, x: h.x, z: h.z, yaw: h.yaw, len: h.len, depth: h.depth, loggia: rnd() < 0.45 ? ( rnd() < 0.5 ? 'left' : 'right' ) : null, terrace: h.terrace };
		if ( rnd() < 0.3 ) o.seam = true;
		// a kitchen garden in the wide gap to its left
		const next = r.homes[ i + 1 ];
		if ( i > 0 && h.gapBefore > 11 ) o.garden = Math.round( h.gapBefore - 3.5 );
		lines.push( '\t' + fmt( o ) + ',' );

	} );

	rowIds.push( ids );

}

// stairs between consecutive rows of a hillside, through ordinary gaps of the lower row (not the gardens'),
// about a third and two thirds along it
const stairs = [];
for ( let i = 0; i < rows.length - 1; i ++ ) {

	const a = rows[ i ], b = rows[ i + 1 ];
	if ( a.name[ 0 ] !== b.name[ 0 ] ) continue;
	const gaps = [];
	for ( let k = 0; k < a.homes.length - 1; k ++ ) if ( ! ( a.homes[ k + 1 ].gapBefore > 11 ) ) gaps.push( k );
	const want = a.homes.length > 5 ? [ 0.3, 0.75 ] : [ 0.5 ];
	const pick = [ ...new Set( want.map( ( f ) => gaps.reduce( ( best, g ) => Math.abs( g / ( a.homes.length - 2 ) - f ) < Math.abs( best / ( a.homes.length - 2 ) - f ) ? g : best, gaps[ 0 ] ) ) ) ];
	stairs.push( `{ rows: [ ${ i }, ${ i + 1 } ], gaps: [ ${ pick.join( ', ' ) } ] }` );

}

console.log( lines.join( '\n' ) );
console.log( '---ROWS' );
console.log( rowIds.map( ( ids ) => '\t[ ' + ids.map( ( d ) => `'${ d }'` ).join( ', ' ) + ' ],' ).join( '\n' ) );
console.log( '---STAIRS' );
console.log( '\t' + stairs.join( ', ' ) + ',' );

function fmt( o ) {

	const v = ( x ) => typeof x === 'string' ? `'${ x }'` : typeof x === 'number' ? ( x < 0 ? '- ' + - x : String( x ) ) : String( x );
	return '{ ' + Object.entries( o ).map( ( [ k, x ] ) => `${ k }: ${ v( x ) }` ).join( ', ' ) + ' }';

}
