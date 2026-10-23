import { Vector3 } from '../../engine/index.js';
import { Part } from '../village/GeoBuilder.js';
import { meshField, noise3, smin } from './Sdf.js';
import { buildGarden } from './Landscape.js';

// Around a home (reference/home-v2.png): big rounded sandstone boulders bedded in the planting, and for
// some homes (Plan: garden) a kitchen garden beside the terrace: raised beds with bean poles, a woodshed
// with its stack, a rain barrel and a watering can, a stone trough, a rustic rail fence round it.

const GREY_OAK = [ 0.6, 0.55, 0.48 ];
const OAK = [ 0.62, 0.45, 0.3 ];
const BARK = [ 0.45, 0.35, 0.26 ];

// A sandstone boulder: a lumpy, softly rounded mass (two or three blended blobs), meshed from its field.
// (x, y, z) = where it sits (in the builder's current frame), r = its radius; half of it is in the ground.
export function sandstoneBoulder( B, x, y, z, r, rand ) {

	const seed = rand.next() * 100;
	const blobs = [ [ 0, 0, 0, r ] ];
	for ( let k = 0; k < 2; k ++ ) blobs.push( [ ( rand.next() - 0.5 ) * r, ( rand.next() - 0.6 ) * r * 0.4, ( rand.next() - 0.5 ) * r, r * ( 0.5 + rand.next() * 0.3 ) ] );
	const sy = 0.7 + rand.next() * 0.2;
	const f = ( px, py, pz ) => {

		let d = Infinity;
		for ( const [ bx, by, bz, br ] of blobs ) d = smin( d, Math.hypot( px - bx, ( py - by ) / sy, pz - bz ) * Math.min( 1, sy ) - br, r * 0.4 );
		return d + noise3( px * 1.6 / r + seed, py * 1.6 / r, pz * 1.6 / r ) * r * 0.12 + noise3( px * 5 / r, py * 5 / r + seed, pz * 5 / r ) * r * 0.03;

	};

	const R = r * 1.9;
	const m = meshField( f, [ - R, - r * 0.5, - R ], [ R, R, R ], Math.max( 0.06, r * 0.13 ) );
	const uv = new Float32Array( m.p.length / 3 * 2 );
	B.part( 'stone', new Part( m.p, m.n, uv, m.idx ), x, y, z, { ry: rand.next() * 6.28, data: [ rand.next(), 10, 0.5, 0 ] } );

}

// a few boulders bedded round a home's terrace (local frame of the home; groundL = ground above the floor)
export function homeBoulders( B, s, g, groundL, rand, n = 3 ) {

	for ( let k = 0; k < n; k ++ ) {

		const side = rand.next() < 0.5 ? - 1 : 1;
		const lx = side * ( s.L / 2 + 1.4 + rand.next() * 2.0 );
		const lz = rand.next() * g.terrace;
		const r = 0.5 + rand.next() * 0.55;
		sandstoneBoulder( B, lx, groundL( lx, lz ) - r * 0.35, lz, r, rand );

	}

}

// The kitchen garden beside a home: world placement from the home's frame (it lies off the house's left end,
// from the front wall out over the terrace's depth). Returns footprints for the plants.
export function buildHomeGarden( B, h, g, ground, rand, drapes, plantings ) {

	const c = Math.cos( h.yaw ), s = Math.sin( h.yaw );
	const W = 11, x1 = - h.len / 2 - 1.6, x0 = x1 - W;
	const toW = ( lx, lz ) => [ h.x + lx * c + lz * s, h.z - lx * s + lz * c ];
	// raised beds in two rows (buildGarden lays them in a grid on the ground)
	const [ gx, gz ] = toW( ( x0 + x1 ) / 2 + 0.6, 1.6 );
	const beds = buildGarden( B, { x: gx, z: gz, yaw: h.yaw, rows: 2, cols: 2, bed: [ 1.3, 3.3 ] }, ground, rand );
	for ( const b of beds ) {

		const bc = Math.cos( b.yaw ), bs = Math.sin( b.yaw );
		for ( let i = 0; i < 5; i ++ ) for ( let j = 0; j < 2; j ++ ) {

			const lx = ( i - 2 ) / 5 * ( b.l - 0.3 ), lz = ( j - 0.5 ) * ( b.w * 0.5 );
			plantings.push( { x: b.x + lx * bc + lz * bs, z: b.z - lx * bs + lz * bc, y: b.y, s: 0.42 + rand.next() * 0.15, kind: rand.next() < 0.6 ? 'shrub' : 'fern', crop: true } );

		}

	}

	// bean poles over the back beds: leaning pairs tied at a ridge pole, vines climbing them
	for ( const b of beds.slice( 0, 2 ) ) {

		B.pushAt( b.x, b.y, b.z, b.yaw );
		const n = 5, L = b.l - 0.4;
		for ( let i = 0; i < n; i ++ ) {

			const x = - L / 2 + L * i / ( n - 1 );
			for ( const sd of [ - 1, 1 ] ) B.rod( 'wood', [ x, 0, sd * 0.45 ], [ x, 2.05, - sd * 0.08 ], 0.022, 0.016, { segs: 5, data: [ rand.next(), 0, 0, 0.7 ], tint: BARK } );
			if ( drapes ) for ( const sd of [ - 1, 1 ] ) {

				const top = B.toWorld( x, 1.85, sd * 0.06 );
				const out = new Vector3( sd * Math.sin( b.yaw ), 0, sd * Math.cos( b.yaw ) );
				drapes.strand( top, out, 1.3 + rand.next() * 0.4, 0.3, rand.next(), 0.2 );

			}

		}

		B.rod( 'wood', [ - L / 2 - 0.2, 1.95, 0 ], [ L / 2 + 0.2, 1.95, 0 ], 0.025, 0.025, { segs: 5, data: [ rand.next(), 0, 0, 0.7 ], tint: BARK } );
		B.pop();

	}

	// the woodshed: a lean-to on four posts at the garden's back corner, a stack of split logs under it
	{

		const [ wx, wz ] = toW( x0 + 1.6, - 1.2 );
		const gy = ground( wx, wz );
		B.pushAt( wx, gy, wz, h.yaw );
		const wood = () => ( { data: [ rand.next(), 0, 0, 0.6 ], tint: GREY_OAK } );
		for ( const [ px, pz, hh ] of [ [ - 1.2, - 0.7, 2.1 ], [ 1.2, - 0.7, 2.1 ], [ - 1.2, 0.7, 1.75 ], [ 1.2, 0.7, 1.75 ] ] ) B.box( 'wood', px, hh / 2 - 0.2, pz, 0.12, hh + 0.4, 0.12, wood() );
		B.pushAt( 0, 1.98, 0, 0, 0.24 );
		B.box( 'wood', 0, 0, 0, 2.9, 0.05, 1.9, { data: [ rand.next(), 0, 5, 0.6 ], tint: GREY_OAK } );
		B.pop();
		for ( let row = 0; row < 6; row ++ ) for ( let k = 0; k < 10; k ++ ) {

			const r = 0.07 + rand.next() * 0.03;
			B.cyl( 'wood', - 1.05 + k * 0.215 + ( row % 2 ) * 0.1, 0.1 + row * 0.17 + r, - 0.55, r, r, 1.0, { rx: Math.PI / 2, segs: 6, data: [ rand.next(), 0, 0, 0.4 ], tint: [ 0.7, 0.55, 0.38 ] } );

		}

		B.pop();
		plantings.push( { x: wx, z: wz, y: gy, s: 0.01, kind: 'fern' } );

	}

	// a rain barrel and a watering can; a stone trough
	{

		const [ bx, bz ] = toW( x1 - 0.8, - 0.4 );
		const gy = ground( bx, bz );
		B.lathe( 'wood', bx, gy, bz, [ [ 0.3, 0 ], [ 0.36, 0.45 ], [ 0.3, 0.9 ], [ 0.28, 0.9 ] ], { segs: 16, data: [ rand.next(), 0, 5, 0.4 ], tint: OAK } );
		for ( const y of [ 0.12, 0.45, 0.78 ] ) B.torus( 'hard', bx, gy + y, bz, 0.335 + ( y === 0.45 ? 0.025 : 0 ), 0.012, { rx: Math.PI / 2, radial: 4, tubular: 18, data: [ rand.next(), 0.5, 0, 0 ], tint: [ 0.25, 0.2, 0.16 ] } );
		const [ cx, cz ] = toW( x1 - 0.6, 0.5 );
		const cy = ground( cx, cz );
		B.cyl( 'hard', cx, cy, cz, 0.12, 0.13, 0.26, { segs: 12, data: [ rand.next(), 0.1, 1, 0 ], tint: [ 0.55, 0.6, 0.62 ] } );
		B.rod( 'hard', [ cx + 0.1, cy + 0.08, cz ], [ cx + 0.38, cy + 0.32, cz ], 0.015, 0.02, { data: [ rand.next(), 0.1, 1, 0 ], tint: [ 0.55, 0.6, 0.62 ] } );
		const [ tx, tz ] = toW( x0 + 4.2, - 0.6 );
		const ty = ground( tx, tz );
		B.box( 'stone', tx, ty + 0.3, tz, 1.3, 0.6, 0.7, { ry: h.yaw, data: [ rand.next(), 3, 0.5, 1.3 ] } );

	}

	// a rail fence along the garden's front and outer side
	{

		const pts = [ [ x0, - 1.5 ], [ x0, g.terrace + 0.5 ], [ x1 - 1.5, g.terrace + 0.5 ] ];
		for ( let i = 0; i < pts.length - 1; i ++ ) {

			const [ ax, az ] = pts[ i ], [ bx, bz ] = pts[ i + 1 ];
			const L = Math.hypot( bx - ax, bz - az ), n = Math.max( 1, Math.round( L / 2.2 ) );
			let prev = null;
			for ( let k = 0; k <= n; k ++ ) {

				const lx = ax + ( bx - ax ) * k / n, lz = az + ( bz - az ) * k / n;
				const [ wx, wz ] = toW( lx, lz );
				const gy = ground( wx, wz );
				B.cyl( 'wood', wx, gy - 0.2, wz, 0.06, 0.07, 1.25, { segs: 6, data: [ rand.next(), 0, 0, 0.7 ], tint: BARK } );
				if ( prev ) for ( const y of [ 0.45, 0.85 ] ) B.rod( 'wood', [ prev[ 0 ], prev[ 1 ] + y, prev[ 2 ] ], [ wx, gy + y, wz ], 0.04, 0.04, { segs: 5, data: [ rand.next(), 0, 0, 0.7 ], tint: BARK } );
				prev = [ wx, gy, wz ];

			}

		}

	}

	const [ fx, fz ] = toW( ( x0 + x1 ) / 2, g.terrace / 2 - 0.5 );
	return [ { x: fx, z: fz, r: W / 2 + 1, kind: 'garden' } ];

}
