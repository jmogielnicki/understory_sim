import { Vector3 } from '../../engine/index.js';
import { Part, lathePart } from '../village/GeoBuilder.js';
import { meshField } from './Sdf.js';
import { homeShape, homeField } from './HomeShape.js';
import { homeBoulders } from './HomeGarden.js';

// A home (reference/home-v2.png, docs/REFERENCE.md): the plastered shell with its planted cap (HomeShape.js,
// meshed from its distance field), and everything set into and around it: timber doors and windows in the
// deep openings, a lantern by the door; under the great arch an outdoor kitchen (a domed oven, shelves of
// jars, a long table, lanterns hung from the vault, a rain chain at its edge); on the roof oval skylights
// and a chimney; in front a flagged terrace on a curved wall of big rounded blocks, a pergola or an awning
// over the front, pots of plants; vines trailing from the cap's lip.
//
// Local frame (as HomeShape): x along the front, y up from the floor, z out of the hill.
// Builder keys: 'stone' (pattern 8 for the shell, see SettlementMaterials), 'glazing', 'wood', 'hard',
// 'glow', 'fabric' (the village cloth: awnings).

const CELL = 0.15; // the shell's mesh resolution (m)
const OAK = [ 0.62, 0.45, 0.3 ];
const HONEY = [ 0.78, 0.55, 0.33 ];
const GREY_OAK = [ 0.6, 0.55, 0.48 ];
const IRON = [ 0.18, 0.16, 0.15 ];

const V = ( x, y, z ) => new Vector3( x, y, z );

// a flat, convex outline (2d points, counter-clockwise seen from +z) at depth z, facing +z; uv = (x, y) - uv0
function flatPart( pts, z, uv0 = [ 0, 0 ] ) {

	let cx = 0, cy = 0;
	for ( const [ x, y ] of pts ) {

		cx += x; cy += y;

	}

	cx /= pts.length; cy /= pts.length;
	const p = [ cx, cy, z ], n = [ 0, 0, 1 ], uv = [ cx - uv0[ 0 ], cy - uv0[ 1 ] ], idx = [];
	for ( let i = 0; i < pts.length; i ++ ) {

		p.push( pts[ i ][ 0 ], pts[ i ][ 1 ], z );
		n.push( 0, 0, 1 );
		uv.push( pts[ i ][ 0 ] - uv0[ 0 ], pts[ i ][ 1 ] - uv0[ 1 ] );
		idx.push( 0, 1 + i, 1 + ( i + 1 ) % pts.length );

	}

	return new Part( p, n, uv, idx );

}

// outline of an arch-topped opening: width w from y0 up, straight to `spring`, then a half ellipse of rise r
function archOutline( w, y0, spring, r, n = 14 ) {

	const pts = [ [ - w / 2, y0 ], [ w / 2, y0 ] ];
	for ( let i = 0; i <= n; i ++ ) {

		const t = Math.PI * i / n;
		pts.push( [ Math.cos( t ) * w / 2, spring + Math.sin( t ) * r ] );

	}

	return pts;

}

const circle = ( cx, cy, r, n = 20 ) => Array.from( { length: n }, ( _, i ) => [ cx + Math.cos( i / n * Math.PI * 2 ) * r, cy + Math.sin( i / n * Math.PI * 2 ) * r ] );

// a timber frame along a polyline of 2d points at depth z (w: width in the wall plane, d: depth)
function frameAlong( B, pts, z, w, d, rand, closed = false ) {

	const n = closed ? pts.length : pts.length - 1;
	for ( let i = 0; i < n; i ++ ) {

		const a = pts[ i ], b = pts[ ( i + 1 ) % pts.length ];
		B.beam( 'wood', [ a[ 0 ], a[ 1 ], z ], [ b[ 0 ], b[ 1 ], z ], d, w, { extend: 0.02, data: [ rand.next(), 0, 0, 0.3 ], tint: OAK } );

	}

}

// march a probe through the field: first parameter in [ a, b ] (stepping by `step`) where it goes inside
function probe( f, a, b, step, at ) {

	const dir = Math.sign( b - a );
	let t = a, prev = f( ...at( t ) );
	for ( ; dir * ( b - t ) > 0; t += step * dir ) {

		const v = f( ...at( t ) );
		if ( v < 0 && prev >= 0 ) {

			// refine between t - step and t
			let lo = t - step * dir, hi = t;
			for ( let k = 0; k < 6; k ++ ) {

				const m = ( lo + hi ) / 2;
				if ( f( ...at( m ) ) < 0 ) hi = m;
				else lo = m;

			}

			return ( lo + hi ) / 2;

		}

		prev = v;

	}

	return null;

}

// the room seen through a window: the glazing shader traces a vault of half-span ai and rise bi behind the
// pane (vdata.w packs them; uv = metres from the room's axis, above its floor)
const roomPack = ( ai, bi ) => Math.round( bi * 100 ) * 100 + ai;

function door( B, s, o, rand, lit ) {

	const z = - s.recess;
	const seed = rand.next();
	// two plank leaves under a timber frame, a small arched light in each; honey-coloured oak
	const w = o.w - 0.1;
	B.part( 'wood', flatPart( archOutline( w, 0, o.spring, o.r - 0.05 ), z + 0.04, [ o.x, 0 ] ), o.x, 0, 0, { data: [ seed, 0, 3, 0.25 ], tint: HONEY } );
	frameAlong( B, archOutline( o.w - 0.04, 0, o.spring, o.r - 0.02 ).slice( 1 ).concat( [ [ - o.w / 2 + 0.02, 0 ] ] ).map( ( [ x, y ] ) => [ x + o.x, y ] ), z + 0.06, 0.09, 0.12, rand );
	B.box( 'wood', o.x, o.spring * 0.5, z + 0.07, 0.07, o.spring, 0.06, { data: [ rand.next(), 0, 0, 0.3 ], tint: OAK } );
	for ( const sd of [ - 1, 1 ] ) {

		// the lights: small arched panes high in each leaf, and iron studs and ring handles
		const cx = o.x + sd * w / 4;
		B.part( 'glazing', flatPart( archOutline( w * 0.26, o.spring - 0.25, o.spring - 0.02, w * 0.13, 8 ), z + 0.055 ), cx, 0, 0, { data: [ seed, lit, 0, 0 ] } );
		B.torus( 'hard', o.x + sd * 0.12, 1.02, z + 0.1, 0.06, 0.008, { rx: Math.PI / 2, data: [ rand.next(), 0.2, 0, 0 ], tint: IRON } );

	}

	// the step: a dressed sandstone threshold
	B.box( 'stone', o.x, 0.02, z / 2 + 0.12, o.w + 0.3, 0.12, - z + 0.4, { data: [ seed, 3, 0.2, o.w + 0.3 ] } );
	// a lantern on the wall beside the door
	const lx = o.x + ( o.lantern ?? 1 ) * ( o.w / 2 + 0.38 );
	B.box( 'hard', lx, 2.02, 0.07, 0.04, 0.04, 0.16, { data: [ rand.next(), 0.2, 0, 0 ], tint: IRON } );
	B.box( 'hard', lx, 1.98, 0.17, 0.2, 0.025, 0.2, { data: [ rand.next(), 0.2, 0, 0 ], tint: IRON } );
	B.box( 'hard', lx, 1.67, 0.17, 0.17, 0.025, 0.17, { data: [ rand.next(), 0.2, 0, 0 ], tint: IRON } );
	B.lathe( 'hard', lx, 1.99, 0.17, [ [ 0.15, 0 ], [ 0.02, 0.1 ], [ 0.001, 0.12 ] ], { segs: 4, ry: Math.PI / 4, data: [ rand.next(), 0.2, 0, 0 ], tint: IRON } );
	B.box( 'glazing', lx, 1.83, 0.17, 0.14, 0.3, 0.14, { data: [ seed, 1, 1, 0 ] } );
	return { x: lx, y: 1.83, z: 0.3 };

}

function window_( B, s, o, rand, lit ) {

	const z = - s.recess;
	const seed = rand.next();
	if ( o.kind === 'round' ) {

		B.part( 'glazing', flatPart( circle( o.x, o.y, o.r ), z + 0.04, [ o.x, 0 ] ), 0, 0, 0, { data: [ seed, lit, 0, roomPack( 2.4, s.H + 0.4 ) ] } );
		B.torus( 'wood', o.x, o.y, z + 0.06, o.r - 0.03, 0.045, { radial: 5, tubular: 22, rx: Math.PI / 2, data: [ rand.next(), 0, 0, 0.3 ], tint: OAK } );
		B.box( 'wood', o.x, o.y, z + 0.06, 0.05, o.r * 2 - 0.05, 0.05, { data: [ rand.next(), 0, 0, 0.3 ], tint: OAK } );
		B.box( 'wood', o.x, o.y, z + 0.06, o.r * 2 - 0.05, 0.05, 0.05, { data: [ rand.next(), 0, 0, 0.3 ], tint: OAK } );
		return;

	}

	B.part( 'glazing', flatPart( archOutline( o.w, o.sill, o.spring, o.r ), z + 0.04, [ 0, 0 ] ), o.x, 0, 0, { data: [ seed, lit, 0, roomPack( 2.4, s.H + 0.4 ) ] } );
	// frame round the opening, a mullion and a transom at the spring
	frameAlong( B, archOutline( o.w - 0.05, o.sill, o.spring, o.r - 0.025 ).slice( 1 ).concat( [ [ - o.w / 2 + 0.025, o.sill ] ] ).map( ( [ x, y ] ) => [ x + o.x, y ] ), z + 0.06, 0.07, 0.1, rand );
	B.box( 'wood', o.x, ( o.sill + o.spring + o.r ) / 2, z + 0.06, 0.05, o.spring + o.r - o.sill - 0.05, 0.06, { data: [ rand.next(), 0, 0, 0.3 ], tint: OAK } );
	B.box( 'wood', o.x, o.spring, z + 0.06, o.w - 0.05, 0.05, 0.06, { data: [ rand.next(), 0, 0, 0.3 ], tint: OAK } );
	// a stone sill, a little proud of the wall
	B.box( 'stone', o.x, o.sill - 0.05, ( z + 0.12 ) / 2, o.w + 0.16, 0.08, - z + 0.12, { data: [ seed, 3, 0.25, o.w + 0.16 ] } );

}

// a pot with a plant in it, for the vegetation (pots: terracotta, pattern 6)
function pot( B, lx, ly, lz, r, rand, plantings, kind ) {

	const hgt = r * ( 1.3 + rand.next() * 0.6 );
	const p = { x: lx, y: ly, z: lz };
	B.lathe( 'stone', p.x, p.y, p.z, [ [ r * 0.72, 0 ], [ r, hgt * 0.92 ], [ r * 1.1, hgt * 0.95 ], [ r * 1.1, hgt ], [ r * 0.92, hgt ] ], { segs: 14, data: [ rand.next(), 6, 0, 0 ] } );
	B.lathe( 'stone', p.x, p.y + hgt - 0.06, p.z, [ [ r * 0.92, 0 ], [ 0.01, 0.02 ] ], { segs: 14, data: [ rand.next(), 4, 0, 0 ] } );
	const w = B.toWorld( lx, ly + hgt - 0.05, lz );
	if ( plantings ) plantings.push( { x: w.x, z: w.z, y: w.y, s: r * 1.7, kind: kind ?? ( rand.next() < 0.6 ? 'shrub' : 'fern' ) } );

}

// a timber table with chairs round it (n chairs)
function table( B, lx, lz, yaw, n, rand, len = 1.7, weather = 0.45 ) {

	B.pushAt( lx, 0, lz, yaw );
	const W = len, D = 0.85, H = 0.76;
	const wood = { data: [ rand.next(), 0, 6, weather ], tint: OAK };
	B.box( 'wood', 0, H - 0.025, 0, W, 0.05, D, wood );
	for ( const [ x, z ] of [ [ - W / 2 + 0.1, - D / 2 + 0.1 ], [ W / 2 - 0.1, - D / 2 + 0.1 ], [ - W / 2 + 0.1, D / 2 - 0.1 ], [ W / 2 - 0.1, D / 2 - 0.1 ] ] ) B.box( 'wood', x, H / 2 - 0.02, z, 0.07, H - 0.05, 0.07, wood );
	const chair = ( x, z, ry ) => {

		B.pushAt( x, 0, z, ry );
		B.box( 'wood', 0, 0.45, 0, 0.44, 0.04, 0.42, wood );
		for ( const [ a, b ] of [ [ - 0.19, - 0.18 ], [ 0.19, - 0.18 ], [ - 0.19, 0.18 ], [ 0.19, 0.18 ] ] ) B.box( 'wood', a, 0.22, b, 0.04, 0.44, 0.04, wood );
		for ( const a of [ - 0.19, 0.19 ] ) B.box( 'wood', a, 0.7, - 0.19, 0.04, 0.5, 0.04, wood );
		for ( const y of [ 0.62, 0.78, 0.92 ] ) B.box( 'wood', 0, y, - 0.19, 0.38, 0.05, 0.025, wood );
		B.pop();

	};

	const seats = [];
	const per = Math.max( 1, Math.round( ( W - 0.3 ) / 0.6 ) );
	for ( let i = 0; i < per; i ++ ) {

		const x = ( i - ( per - 1 ) / 2 ) * 0.6;
		seats.push( [ x, - 0.72, 0 ], [ x, 0.72, Math.PI ] );

	}

	seats.push( [ - W / 2 - 0.4, 0, Math.PI / 2 ], [ W / 2 + 0.4, 0, - Math.PI / 2 ] );
	for ( let i = 0; i < Math.min( n, seats.length ); i ++ ) {

		const [ x, z, r ] = seats[ i ];
		chair( x + ( rand.next() - 0.5 ) * 0.1, z, r + ( rand.next() - 0.5 ) * 0.3 );

	}

	B.pop();

}

// a lantern hung on a rod (local position of its body; top = where the rod is fixed)
function hangingLantern( B, x, y, z, top, rand ) {

	B.rod( 'hard', [ x, y + 0.2, z ], [ x, top, z ], 0.008, 0.008, { data: [ rand.next(), 0.2, 0, 0 ], tint: IRON } );
	B.lathe( 'hard', x, y + 0.12, z, [ [ 0.13, 0 ], [ 0.02, 0.09 ], [ 0.001, 0.1 ] ], { segs: 6, data: [ rand.next(), 0.2, 0, 0 ], tint: IRON } );
	B.box( 'hard', x, y - 0.17, z, 0.15, 0.025, 0.15, { data: [ rand.next(), 0.2, 0, 0 ], tint: IRON } );
	B.lathe( 'glazing', x, y - 0.16, z, [ [ 0.08, 0 ], [ 0.1, 0.12 ], [ 0.1, 0.2 ], [ 0.07, 0.28 ] ], { segs: 6, data: [ rand.next(), 1, 1, 0 ] } );

}

// the outdoor kitchen under the great arch
function loggia( B, s, F, rand, lights, plantings, seam ) {

	const l = s.loggia;
	const { xc, S, R, T, Dl, sg } = l;
	const seed = rand.next();
	// flags over the floor, out through the end arch
	const xa = xc - S / 2 - 0.2 + ( sg < 0 ? - T - 0.8 : 0 ), xb = xc + S / 2 + 0.2 + ( sg > 0 ? T + 0.8 : 0 );
	B.slab( 'stone', [ V( xa, 0.04, 0.5 ), V( xb, 0.04, 0.5 ), V( xb, 0.04, - Dl - 0.05 ), V( xa, 0.04, - Dl - 0.05 ) ], 0.3, { data: [ seed, 1, 0.15, 0 ], up: V( 0, 1, 0 ) } );
	// the oven against the back wall, on a stone plinth: a plastered dome, its mouth glowing
	const ox = xc - sg * S * 0.2, oz = - Dl + 0.85;
	B.box( 'stone', ox, 0.45, oz, 1.5, 0.9, 1.3, { data: [ seed + 0.1, 3, 0.2, 1.5 ] } );
	B.lathe( 'stone', ox, 0.9, oz, [ [ 0.68, 0 ], [ 0.66, 0.2 ], [ 0.56, 0.45 ], [ 0.36, 0.66 ], [ 0.001, 0.75 ] ], { segs: 18, data: [ seed, 8, 0, - 3 ] } );
	// its mouth: a sooty arch, the fire glowing low inside it
	B.part( 'stone', flatPart( archOutline( 0.46, 0.9, 1.07, 0.23, 8 ), oz + 0.685, [ 0, 0 ] ), ox, 0, 0, { data: [ seed, 4, 0, 0 ] } );
	B.part( 'glow', flatPart( archOutline( 0.36, 0.9, 0.98, 0.16, 8 ), oz + 0.69, [ 0, 0 ] ), ox, 0, 0, { data: [ seed, 0, 0, 0 ], tint: [ 1.0, 0.38, 0.08 ] } );
	B.box( 'stone', ox, 0.93, oz + 0.72, 0.62, 0.06, 0.18, { data: [ seed + 0.2, 3, 0.2, 0.62 ] } );
	// its flue up into the vault
	B.lathe( 'stone', ox, 1.6, oz - 0.2, [ [ 0.16, 0 ], [ 0.14, R - 1.3 ] ], { segs: 10, data: [ seed, 8, 0, - 3 ] } );
	lights.push( { lx: ox, ly: 1.1, lz: oz + 1.0, kind: 'fire' } );
	// shelves on the back wall beside it: boards on brackets, jars and pots
	const shx = xc + sg * S * 0.18;
	for ( const y of [ 1.15, 1.6, 2.05 ] ) {

		B.box( 'wood', shx, y, - Dl + 0.16, 1.7, 0.04, 0.3, { data: [ rand.next(), 0, 0, 0.3 ], tint: OAK } );
		for ( let x = - 0.75; x < 0.75; x += 0.14 + rand.next() * 0.12 ) {

			if ( rand.next() < 0.3 ) continue;
			const r = 0.04 + rand.next() * 0.04, hh = 0.1 + rand.next() * 0.14;
			const glass = rand.next() < 0.4;
			B.lathe( glass ? 'glazing' : 'stone', shx + x, y + 0.02, - Dl + 0.17, [ [ r * 0.8, 0 ], [ r, hh * 0.3 ], [ r, hh * 0.8 ], [ r * 0.6, hh ] ], { segs: 8, data: glass ? [ rand.next(), 0.3, 1, 0 ] : [ rand.next(), 6, 0, 0 ] } );

		}

	}

	// a worktop under the shelves
	B.box( 'wood', shx, 0.88, - Dl + 0.4, 1.9, 0.06, 0.7, { data: [ rand.next(), 0, 6, 0.3 ], tint: OAK } );
	B.box( 'stone', shx - 0.8, 0.43, - Dl + 0.4, 0.2, 0.86, 0.6, { data: [ seed + 0.3, 3, 0.2, 0.2 ] } );
	B.box( 'stone', shx + 0.8, 0.43, - Dl + 0.4, 0.2, 0.86, 0.6, { data: [ seed + 0.4, 3, 0.2, 0.2 ] } );
	// the long table and its chairs
	table( B, xc, - Dl * 0.42, Math.PI / 2 * 0 + ( rand.next() - 0.5 ) * 0.06, 6 + Math.floor( rand.next() * 3 ), rand, 2.2, 0.08 );
	// lanterns hung from the vault over the table
	for ( const dx of [ - 0.9, 0.9 ] ) {

		const z = - Dl * 0.42, y = 2.55;
		const u = dx / ( S / 2 );
		const top = R * Math.sqrt( 1 - u * u );
		hangingLantern( B, xc + dx, y, z, top, rand );
		lights.push( { lx: xc + dx, ly: y - 0.1, lz: z, kind: 'lantern' } );

	}

	// a rain chain from the arch's edge into a stone basin (cups of copper-brown clay)
	{

		const x = xc + sg * ( S / 2 - 0.35 );
		const u = ( x - xc ) / ( S / 2 );
		const top = R * Math.sqrt( 1 - u * u ) - 0.05;
		for ( let y = top - 0.15; y > 0.6; y -= 0.19 ) B.lathe( 'stone', x, y, 0.2, [ [ 0.02, 0 ], [ 0.06, 0.1 ], [ 0.065, 0.12 ] ], { segs: 8, data: [ rand.next(), 6, 0, 0 ] } );
		B.rod( 'hard', [ x, 0.6, 0.2 ], [ x, top, 0.2 ], 0.005, 0.005, { data: [ rand.next(), 0.6, 0, 0 ], tint: [ 0.45, 0.25, 0.12 ] } );
		B.lathe( 'stone', x, 0, 0.2, [ [ 0.28, 0 ], [ 0.34, 0.45 ], [ 0.36, 0.5 ], [ 0.28, 0.5 ], [ 0.27, 0.42 ] ], { segs: 16, data: [ rand.next(), 8, 0, - 3 ] } );

	}

	// pots along the open edge
	for ( let k = 0; k < 3; k ++ ) {

		if ( rand.next() < 0.3 ) continue;
		const x = xc + ( rand.next() - 0.5 ) * S * 0.8;
		if ( Math.abs( x - xc ) < 1.4 ) continue;
		pot( B, x, 0.04, 0.2, 0.22 + rand.next() * 0.1, rand, plantings );

	}

	// the pale blue seam along the arch's face (everyday technology, docs/REFERENCE.md)
	if ( seam ) {

		const a = S / 2 + 0.07, b = R + 0.07, N = 30;
		const zf = probe( F.all, 1.2, - 0.5, 0.02, ( t ) => [ xc, R + 0.3, t ] ) ?? 0.45;
		for ( let i = 0; i < N; i ++ ) {

			const t0 = Math.PI * i / N, t1 = Math.PI * ( i + 1 ) / N;
			B.beam( 'glow', [ xc + Math.cos( t0 ) * a, Math.sin( t0 ) * b, zf + 0.004 ], [ xc + Math.cos( t1 ) * a, Math.sin( t1 ) * b, zf + 0.004 ], 0.012, 0.03, { extend: 0.01, data: [ seed, 0, 0, 0 ], tint: [ 0.42, 0.78, 1.0 ] } );

		}

	}

}

// oval skylight: a raised plaster rim, a shallow glass dome with timber spokes
function skylight( B, x, y, z, r, yaw, seed, rand ) {

	B.lathe( 'stone', x, y, z, [ [ r + 0.24, - 0.3 ], [ r + 0.24, 0.1 ], [ r + 0.08, 0.17 ], [ r, 0.12 ] ], { segs: 22, ry: yaw, sx: 1.5, data: [ seed, 8, 0, - 3 ] } );
	const dome = [];
	for ( let i = 0; i <= 6; i ++ ) {

		const t = i / 6;
		dome.push( [ r * Math.cos( t * Math.PI / 2 ), 0.12 + 0.18 * Math.sin( t * Math.PI / 2 ) ] );

	}

	B.part( 'glazing', lathePart( dome, 22 ), x, y, z, { ry: yaw, sx: 1.5, data: [ seed, 0.12, 2, 0 ] } );
	B.pushAt( x, y, z, yaw );
	for ( let k = 0; k < 8; k ++ ) {

		const a = k / 8 * Math.PI * 2;
		const ex = Math.cos( a ) * r * 1.5, ez = Math.sin( a ) * r;
		B.beam( 'wood', [ ex * 0.12, 0.3, ez * 0.12 ], [ ex, 0.13, ez ], 0.04, 0.04, { data: [ rand.next(), 0, 0, 0.3 ], tint: OAK } );

	}

	B.lathe( 'wood', 0, 0.28, 0, [ [ 0.09, 0 ], [ 0.09, 0.04 ], [ 0.001, 0.05 ] ], { segs: 10, data: [ rand.next(), 0, 0, 0.3 ], tint: OAK } );
	B.pop();

}

// a lean-to pergola over the front: posts along the terrace, a beam, rafters back to the wall; vines over it
// and a lantern under it (x0..x1 along the front, out to `out`)
function pergola( B, x0, x1, out, rand, lights, drapes, toWorld, facing ) {

	const n = Math.max( 2, Math.round( ( x1 - x0 ) / 2.4 ) + 1 );
	const H = 2.45;
	const wood = () => ( { data: [ rand.next(), 0, 0, 0.55 ], tint: GREY_OAK } );
	for ( let k = 0; k < n; k ++ ) {

		const x = x0 + ( x1 - x0 ) * k / ( n - 1 );
		B.box( 'wood', x, H / 2, out, 0.15, H, 0.15, wood() );
		B.box( 'stone', x, 0.08, out, 0.3, 0.16, 0.3, { data: [ rand.next(), 3, 0.3, 0.3 ] } );

	}

	B.box( 'wood', ( x0 + x1 ) / 2, H + 0.09, out, x1 - x0 + 0.5, 0.18, 0.12, wood() );
	const r = Math.round( ( x1 - x0 ) / 0.55 );
	for ( let k = 0; k <= r; k ++ ) {

		const x = x0 - 0.15 + ( x1 - x0 + 0.3 ) * k / r;
		B.beam( 'wood', [ x, H + 0.32, 0.15 ], [ x, H + 0.2, out + 0.35 ], 0.06, 0.12, wood() );

	}

	if ( drapes ) {

		for ( let x = x0; x < x1; x += 0.35 + rand.next() * 0.5 ) {

			if ( rand.next() < 0.25 ) continue;
			drapes.strand( toWorld( x, H + 0.22, out + 0.08 ), facing, 0.4 + rand.next() * 1.1, 0.45 + rand.next() * 0.35, rand.next(), 0.14 );

		}

	}

	const lx = ( x0 + x1 ) / 2 + ( rand.next() - 0.5 ) * ( x1 - x0 ) * 0.4;
	hangingLantern( B, lx, 2.05, out * 0.55, H + 0.25, rand );
	lights.push( { lx, ly: 1.95, lz: out * 0.55, kind: 'lantern' } );

}

// a canvas awning over the front on two or three poles
function awning( B, x0, x1, out, rand, tint ) {

	const H0 = 2.6, H1 = 2.15;
	const n = Math.max( 2, Math.round( ( x1 - x0 ) / 3 ) + 1 );
	for ( let k = 0; k < n; k ++ ) {

		const x = x0 + ( x1 - x0 ) * k / ( n - 1 );
		B.box( 'wood', x, H1 / 2, out, 0.09, H1, 0.09, { data: [ rand.next(), 0, 0, 0.5 ], tint: GREY_OAK } );

	}

	B.box( 'wood', ( x0 + x1 ) / 2, H1, out, x1 - x0 + 0.2, 0.07, 0.07, { data: [ rand.next(), 0, 0, 0.5 ], tint: GREY_OAK } );
	// the cloth: a sloping sheet with a scalloped front edge
	const p = [], nn = [], uv = [], idx = [];
	const N = Math.max( 6, Math.round( ( x1 - x0 ) / 0.35 ) );
	const ny = Math.cos( Math.atan2( out, H0 - H1 ) ), nz = Math.sin( Math.atan2( out, H0 - H1 ) );
	for ( let i = 0; i <= N; i ++ ) {

		const x = x0 - 0.1 + ( x1 - x0 + 0.2 ) * i / N;
		const scal = 0.12 * Math.abs( Math.sin( i / N * Math.PI * ( N / 2 ) ) );
		p.push( x, H0, 0.05, x, H1 + 0.02, out + 0.1, x, H1 - 0.16 - scal, out + 0.12 );
		nn.push( 0, ny, nz, 0, ny, nz, 0, 0, 1 );
		uv.push( x, 0, x, out, x, out + 0.2 );
		if ( i > 0 ) {

			const b = ( i - 1 ) * 3;
			idx.push( b, b + 1, b + 4, b, b + 4, b + 3, b + 1, b + 2, b + 5, b + 1, b + 5, b + 4 );

		}

	}

	B.part( 'fabric', new Part( p, nn, uv, idx ), 0, 0, 0, { data: [ rand.next(), 0, 0, 0 ], tint } );

}

// The terrace's retaining wall along a polyline of local points (the terrace's edge, its inside to the left
// walking along it): a thick wall of big rounded blocks from the ground outside up to the floor, rising into
// a low parapet where the drop is more than ~0.6 m. Only built where the ground has fallen away.
function terraceWall( B, pts, groundAt, seed, parapet, gaps = [] ) {

	const n = pts.length;
	const t = 0.5;
	// mitred outward normals at the vertices
	const nrm = pts.map( ( _, i ) => {

		const a = pts[ Math.max( 0, i - 1 ) ], b = pts[ Math.min( n - 1, i + 1 ) ];
		const dx = b[ 0 ] - a[ 0 ], dz = b[ 1 ] - a[ 1 ], l = Math.hypot( dx, dz ) || 1;
		return [ - dz / l, dx / l ];

	} );
	// sample along the edge every ~0.5 m
	const S = [];
	let u = 0;
	for ( let i = 0; i < n - 1; i ++ ) {

		const [ x0, z0 ] = pts[ i ], [ x1, z1 ] = pts[ i + 1 ];
		const L = Math.hypot( x1 - x0, z1 - z0 );
		const k = Math.max( 1, Math.ceil( L / 0.5 ) );
		for ( let j = 0; j < k; j ++ ) {

			const f = j / k;
			const nx = nrm[ i ][ 0 ] * ( 1 - f ) + nrm[ i + 1 ][ 0 ] * f, nz = nrm[ i ][ 1 ] * ( 1 - f ) + nrm[ i + 1 ][ 1 ] * f;
			const nl = Math.hypot( nx, nz ) || 1;
			S.push( { x: x0 + ( x1 - x0 ) * f, z: z0 + ( z1 - z0 ) * f, nx: nx / nl, nz: nz / nl, u: u + L * f } );

		}

		u += L;

	}

	S.push( { x: pts[ n - 1 ][ 0 ], z: pts[ n - 1 ][ 1 ], nx: nrm[ n - 1 ][ 0 ], nz: nrm[ n - 1 ][ 1 ], u } );
	for ( const c of S ) {

		c.g = groundAt( c.x + c.nx * 1.0, c.z + c.nz * 1.0 );
		// (no parapet across the head of the steps: gaps are [ x0, x1 ] along the front)
		const open = gaps.some( ( [ a, b ] ) => c.x > a && c.x < b && c.z > 0.5 );
		c.gap = open;
		c.top = c.g < - 0.6 && ! open ? parapet : 0.03;
		c.bot = Math.min( c.g - 0.4, - 0.25 );

	}

	// smooth the parapet's ends into ramps
	for ( let pass = 0; pass < 3; pass ++ ) for ( let i = 1; i < S.length - 1; i ++ ) if ( S[ i ].top < parapet && ! S[ i ].gap ) S[ i ].top = Math.max( S[ i ].top, Math.min( ( S[ i - 1 ].top + S[ i + 1 ].top ) / 2 - 0.1, parapet ) );
	if ( ! S.some( ( c ) => c.g < - 0.25 ) ) return false;
	const pos = [], nn = [], uv = [], idx = [];
	const strip = ( fn ) => {

		const base = pos.length / 3;
		for ( const c of S ) for ( const [ x, y, z, a, b, cc, uu, vv ] of fn( c ) ) {

			pos.push( x, y, z ); nn.push( a, b, cc ); uv.push( uu, vv );

		}

		for ( let i = 0; i < S.length - 1; i ++ ) {

			const v = base + i * 2;
			idx.push( v, v + 2, v + 3, v, v + 3, v + 1 );

		}

	};

	// outer face (bottom, top), the top (outer edge to inner edge), the inner face (top down to the floor)
	strip( ( c ) => [ [ c.x + c.nx * t, c.bot, c.z + c.nz * t, c.nx, 0, c.nz, c.u, c.bot ], [ c.x + c.nx * t, c.top, c.z + c.nz * t, c.nx, 0, c.nz, c.u, c.top ] ] );
	strip( ( c ) => [ [ c.x + c.nx * t, c.top, c.z + c.nz * t, 0, 1, 0, c.u, c.top ], [ c.x, c.top, c.z, 0, 1, 0, c.u, c.top + t ] ] );
	strip( ( c ) => [ [ c.x, c.top, c.z, - c.nx, 0, - c.nz, c.u, c.top + t ], [ c.x, 0, c.z, - c.nx, 0, - c.nz, c.u, c.top * 2 + t ] ] );
	B.part( 'stone', new Part( pos, nn, uv, idx ), 0, 0, 0, { data: [ seed, 9, 0.4, 0 ] } );
	return true;

}

// the terrace's outline: a rectangle in front of the house with rounded front corners (local xz)
export function terraceOutline( xl, xr, depth, r = 2.2 ) {

	const pts = [ [ xl, 0 ] ];
	const n = 6;
	for ( let i = 0; i <= n; i ++ ) {

		const a = Math.PI + Math.PI / 2 * ( i / n );
		pts.push( [ xl + r + Math.cos( a ) * r, depth - r - Math.sin( a ) * r ] );

	}

	for ( let i = 0; i <= n; i ++ ) {

		const a = Math.PI * 1.5 + Math.PI / 2 * ( i / n );
		pts.push( [ xr - r + Math.cos( a ) * r, depth - r - Math.sin( a ) * r ] );

	}

	pts.push( [ xr, 0 ] );
	return pts;

}

// Build one home. g: Grading.home() result. Returns the light sources, colliders and plants.
export function buildHome( B, h, g, rand, groundAt, drapes = null, plantings = null, lavender = null ) {

	const s = homeShape( h, rand );
	const F = homeField( s );
	const floorY = g.floorY;
	const c = Math.cos( h.yaw ), sn = Math.sin( h.yaw );
	const toWorld = ( lx, ly, lz ) => new Vector3( h.x + lx * c + lz * sn, floorY + ly, h.z - lx * sn + lz * c );
	const groundL = ( lx, lz ) => groundAt( h.x + lx * c + lz * sn, h.z - lx * sn + lz * c ) - floorY;
	const facing = new Vector3( sn, 0, c );
	const lights = [];
	B.pushAt( h.x, floorY, h.z, h.yaw );

	// ---- the shell: meshed from the field; what is under the ground left out
	{

		const m = meshField( F.all, F.lo, F.hi, h.cell ?? CELL );
		const nv = m.p.length / 3;
		const keep = new Uint8Array( nv );
		const uv = new Float32Array( nv * 2 );
		for ( let v = 0; v < nv; v ++ ) {

			const x = m.p[ v * 3 ], y = m.p[ v * 3 + 1 ], z = m.p[ v * 3 + 2 ];
			keep[ v ] = y > - 0.25 && y > groundL( x, z ) - 0.3 ? 1 : 0;
			uv[ v * 2 ] = x; uv[ v * 2 + 1 ] = y;

		}

		const idx = [];
		for ( let t = 0; t < m.idx.length; t += 3 ) {

			const a = m.idx[ t ], b = m.idx[ t + 1 ], d = m.idx[ t + 2 ];
			if ( keep[ a ] || keep[ b ] || keep[ d ] ) idx.push( a, b, d );

		}

		const seed = s.seed;
		const ss = ( a, b, x ) => {

			const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) );
			return t * t * ( 3 - 2 * t );

		};

		B.part( 'stone', new Part( m.p, m.n, uv, idx ), 0, 0, 0, { data: ( x, y, z ) => [ seed, 8, ss( - 0.07, 0.07, F.house( x, y, z ) - F.turf( x, y, z ) ), y - F.eave( x ) ] } );
		s.triangles = idx.length / 3;

	}

	// ---- doors and windows
	const lit = () => rand.range( 0.55, 1.0 );
	for ( const o of s.openings ) {

		if ( o.kind === 'door' ) {

			o.lantern = rand.next() < 0.5 ? - 1 : 1;
			const L = door( B, s, o, rand, lit() );
			lights.push( { lx: L.x, ly: L.y, lz: L.z, kind: 'lantern' } );
			lights.push( { lx: o.x, ly: 1.4, lz: - s.recess - 0.8, kind: 'window' } );

		} else {

			window_( B, s, o, rand, lit() );
			if ( rand.next() < 0.4 ) lights.push( { lx: o.x, ly: 1.4, lz: - s.recess - 0.8, kind: 'window' } );

		}

	}

	// ---- the outdoor kitchen under the great arch
	if ( s.loggia ) loggia( B, s, F, rand, lights, plantings, h.seam ?? rand.next() < 0.5 );

	// ---- on the roof: skylights over the rooms, a chimney
	const roofY = ( x, z ) => probe( F.all, F.hi[ 1 ], 0, 0.05, ( t ) => [ x, t, z ] );
	// (over the closed part of the house, not the arch)
	let bx0 = - s.L / 2 + 2.6, bx1 = s.L / 2 - 2.6;
	if ( s.loggia && s.loggia.sg > 0 ) bx1 = Math.min( bx1, s.loggia.xc - s.loggia.S / 2 - s.loggia.T - 0.4 );
	if ( s.loggia && s.loggia.sg < 0 ) bx0 = Math.max( bx0, s.loggia.xc + s.loggia.S / 2 + s.loggia.T + 0.4 );
	const nSky = h.skylights ?? ( 1 + ( rand.next() < 0.5 ? 1 : 0 ) );
	for ( let i = 0; i < nSky; i ++ ) {

		const x = nSky === 1 ? ( bx0 + bx1 ) / 2 + rand.range( - 1, 1 ) : bx0 + ( bx1 - bx0 ) * ( i / ( nSky - 1 ) ) * 0.8 + ( bx1 - bx0 ) * 0.1;
		const z = - s.D * rand.range( 0.38, 0.55 );
		const y = roofY( x, z );
		if ( y !== null ) skylight( B, x, y - 0.06, z, rand.range( 0.55, 0.75 ), rand.range( - 0.15, 0.15 ), rand.next(), rand );

	}

	if ( h.chimney ?? true ) {

		const x = rand.range( bx0, bx1 ), z = - s.D * rand.range( 0.6, 0.72 );
		const y = roofY( x, z );
		if ( y !== null ) {

			B.lathe( 'stone', x, y - 0.4, z, [ [ 0.3, 0 ], [ 0.27, 0.9 ], [ 0.33, 0.96 ], [ 0.33, 1.06 ], [ 0.24, 1.06 ] ], { segs: 14, data: [ rand.next(), 8, 0, - 3 ] } );
			B.lathe( 'stone', x, y + 0.66, z, [ [ 0.15, 0 ], [ 0.17, 0.22 ], [ 0.13, 0.32 ], [ 0.14, 0.36 ], [ 0.11, 0.36 ] ], { segs: 12, data: [ rand.next(), 6, 0, 0 ] } );

		}

	}

	// ---- the terrace: flags on a curved retaining wall of big blocks
	const td = g.terrace;
	const xl = - s.L / 2 - 0.8, xr = s.L / 2 + 0.8;
	const outline = terraceOutline( xl, xr, td );
	B.slab( 'stone', outline.map( ( [ x, z ] ) => V( x, 0, z ) ), 0.3, { data: [ s.seed + 0.9, 1, 0.3, 0 ], up: V( 0, 1, 0 ) } );
	const door0 = s.openings[ 0 ];
	terraceWall( B, outline, groundL, s.seed + 0.13, 0.5, [ [ door0.x - 1.15, door0.x + 1.15 ] ] );

	// steps down off the terrace's front where it stands above the ground (centred on the door)
	{

		const drop = - groundL( door0.x, td + 1.2 );
		if ( drop > 0.25 ) {

			const n = Math.min( 9, Math.ceil( drop / 0.17 ) ), rise = drop / n;
			if ( lavender ) for ( const sd of [ - 1, 1 ] ) {

				const p = toWorld( door0.x + sd * 1.45, 0, td + 0.5 + n * 0.17 );
				lavender.clump( p.x, groundAt( p.x, p.z ), p.z, 0.4, rand );

			}

			for ( let k = 0; k < n; k ++ ) {

				const y = - rise * ( k + 1 ) + 0.02;
				const z = td + 0.2 + k * 0.34;
				B.box( 'stone', door0.x, y - 0.25 + rise / 2, z + 0.17, 1.9, 0.5 + rise, 0.36, { data: [ rand.next(), 3, 0.3, 1.9 ] } );

			}

		}

	}

	// ---- sandstone boulders bedded beside the terrace
	homeBoulders( B, s, g, groundL, rand, h.boulders ?? 3 + Math.floor( rand.next() * 3 ), s.openings[ 0 ].x );

	// ---- over the front: a pergola or an awning, along the straight run beside the door
	{

		const lo = s.loggia && s.loggia.sg < 0 ? s.loggia.xc + s.loggia.S / 2 + s.loggia.T + 0.4 : - s.L / 2 + s.rc * 0.6;
		const hi = s.loggia && s.loggia.sg > 0 ? s.loggia.xc - s.loggia.S / 2 - s.loggia.T - 0.4 : s.L / 2 - s.rc * 0.6;
		const kind = h.porch ?? ( rand.next() < 0.6 ? 'pergola' : 'awning' );
		const span = Math.min( hi - lo, kind === 'pergola' ? 6.5 : 7.5 );
		if ( span > 2.5 && kind !== 'none' ) {

			const mid = Math.min( hi - span / 2, Math.max( lo + span / 2, door0.x ) );
			if ( kind === 'pergola' ) pergola( B, mid - span / 2, mid + span / 2, Math.min( 2.9, td - 0.8 ), rand, lights, drapes, ( x, y, z ) => toWorld( x, y, z ), facing );
			else awning( B, mid - span / 2, mid + span / 2, Math.min( 2.3, td - 1 ), rand, rand.next() < 0.5 ? [ 0.86, 0.78, 0.6 ] : [ 0.8, 0.6, 0.38 ] );

		}

	}

	// ---- the terrace's furniture: a table and chairs where there is room, pots along the wall and the edge
	if ( ! s.loggia || rand.next() < 0.4 ) {

		const x = s.loggia ? - s.loggia.sg * ( s.L / 2 - 2.2 ) : ( rand.next() < 0.5 ? - 1 : 1 ) * ( s.L / 2 - 2.4 );
		table( B, x, Math.min( td - 1.4, 2.4 ), ( rand.next() - 0.5 ) * 0.2, 4, rand );

	}

	if ( plantings ) {

		for ( const o of s.openings ) {

			if ( o.kind === 'door' ) {

				for ( const sd of [ - 1, 1 ] ) if ( rand.next() < 0.7 ) pot( B, o.x + sd * ( o.w / 2 + 0.45 ), 0, 0.5, 0.24 + rand.next() * 0.1, rand, plantings );

			} else if ( rand.next() < 0.45 ) pot( B, o.x + ( rand.next() - 0.5 ) * 0.4, 0, 0.45, 0.2 + rand.next() * 0.12, rand, plantings );

		}

		for ( let i = 1; i < outline.length - 1; i += 2 ) {

			if ( rand.next() < 0.55 ) continue;
			const [ x, z ] = outline[ i ];
			const ix = x + ( x < 0 ? 0.5 : - 0.5 ), iz = z - 0.5;
			pot( B, ix, 0, iz, 0.25 + rand.next() * 0.15, rand, plantings );

		}

		// a planted bank round the foot of the terrace wall: shrubs, ferns and lavender, thick where the wall
		// is high
		for ( let i = 0; i < outline.length - 1; i ++ ) {

			const [ x0, z0 ] = outline[ i ], [ x1, z1 ] = outline[ i + 1 ];
			const L = Math.hypot( x1 - x0, z1 - z0 ) || 1;
			const nx = - ( z1 - z0 ) / L, nz = ( x1 - x0 ) / L;
			for ( let t = rand.next() * 0.8; t < L; t += 0.6 + rand.next() * 0.9 ) {

				const off = 0.8 + rand.next() * 1.3;
				const lx = x0 + ( x1 - x0 ) * t / L + nx * off, lz = z0 + ( z1 - z0 ) * t / L + nz * off;
				const gy = groundL( lx, lz );
				if ( gy > - 0.3 && rand.next() < 0.6 ) continue; // (little bank where the ground is level)
				const p = toWorld( lx, 0, lz );
				const u = rand.next();
				if ( lavender && u < 0.4 ) lavender.clump( p.x, groundAt( p.x, p.z ), p.z, 0.3 + rand.next() * 0.15, rand );
				else plantings.push( { x: p.x, z: p.z, y: groundAt( p.x, p.z ) - 0.05, s: 0.6 + rand.next() * 0.6, kind: u < 0.8 ? 'shrub' : 'fern' } );

			}

		}

		// lavender along the front wall between the openings, and by the steps
		if ( lavender ) for ( let x = - s.L / 2 + 1; x < s.L / 2 - 1; x += 0.7 + rand.next() * 0.8 ) {

			if ( s.openings.some( ( o ) => Math.abs( o.x - x ) < o.w / 2 + 0.4 ) || ( s.loggia && Math.abs( x - s.loggia.xc ) < s.loggia.S / 2 + 0.3 ) ) continue;
			if ( rand.next() < 0.45 ) continue;
			const p = toWorld( x, 0.02, 0.55 + rand.next() * 0.3 );
			lavender.clump( p.x, p.y, p.z, 0.25 + rand.next() * 0.12, rand );

		}

		// shrubs on the roof, along the crest and the shoulders (they break the cap's outline)
		for ( let k = 0; k < Math.round( s.L / 2.5 ); k ++ ) {

			const x = rand.range( - s.L / 2 + 1.5, s.L / 2 - 1.5 ), z = - s.D * rand.range( 0.12, 0.8 );
			const y = roofY( x, z );
			if ( y === null ) continue;
			const p = toWorld( x, y - 0.08, z );
			plantings.push( { x: p.x, z: p.z, y: p.y, s: 0.5 + rand.next() * 0.4, kind: rand.next() < 0.7 ? 'shrub' : 'fern' } );

		}

	}

	B.pop();

	// ---- vines trailing from the cap's lip, along the front and round the rounded ends (more over the great
	// arch): walk the wall's outline at the eave, find the lip outward from it, hang a strand there
	if ( drapes ) {

		const hz = s.D / 2;
		const plan = ( x, z ) => {

			const qx = Math.abs( x ) - s.L / 2 + s.rc, qz = Math.abs( z + hz ) - hz + s.rc;
			return Math.hypot( Math.max( qx, 0 ), Math.max( qz, 0 ) ) + Math.min( Math.max( qx, qz ), 0 ) - s.rc;

		};

		const pts = [];
		// the front's straight run, then the two rounded corners and the ends back to mid depth
		for ( let x = - s.L / 2 + s.rc; x < s.L / 2 - s.rc; x += 0.22 + rand.next() * 0.3 ) pts.push( [ x, 0 ] );
		for ( const sd of [ - 1, 1 ] ) {

			for ( let a = 0; a < Math.PI / 2; a += 0.12 + rand.next() * 0.1 ) pts.push( [ sd * ( s.L / 2 - s.rc + Math.sin( a ) * s.rc ), - s.rc + Math.cos( a ) * s.rc ] );
			for ( let z = - s.rc; z > - s.D * 0.6; z -= 0.3 + rand.next() * 0.3 ) pts.push( [ sd * s.L / 2, z ] );

		}

		for ( const [ wx, wz ] of pts ) {

			// outward normal of the plan here
			const e = 0.05;
			let nx = plan( wx + e, wz ) - plan( wx - e, wz ), nz = plan( wx, wz + e ) - plan( wx, wz - e );
			const nl = Math.hypot( nx, nz ) || 1;
			nx /= nl; nz /= nl;
			const y = F.eave( wx ) + 0.02;
			const t = probe( ( x, yy, z ) => - F.all( x, yy, z ), 0, 1.8, 0.04, ( tt ) => [ wx + nx * tt, y, wz + nz * tt ] );
			if ( t === null ) continue;
			const overArch = s.loggia && Math.abs( wx - s.loggia.xc ) < s.loggia.S / 2 + s.loggia.T && wz > - 0.1;
			if ( rand.next() > ( overArch ? 0.75 : 0.6 ) ) continue;
			const len = overArch ? 0.4 + rand.next() * 1.6 : 0.25 + rand.next() * 1.1;
			drapes.strand( toWorld( wx + nx * ( t + 0.03 ), y, wz + nz * ( t + 0.03 ) ), new Vector3( nx * c + nz * sn, 0, - nx * sn + nz * c ), len, 0.4 + rand.next() * 0.4, rand.next(), 0.12 );

		}

	}

	// lavender and small shrubs on the roof's shoulders (the painting: flowers in the roof meadow)
	if ( lavender ) for ( let k = 0; k < Math.round( s.L / 4 ); k ++ ) {

		const x = rand.range( - s.L / 2 + 1.2, s.L / 2 - 1.2 ), z = - rand.range( 0.6, 2.4 );
		const y = probe( F.all, F.hi[ 1 ], 0, 0.05, ( t ) => [ x, t, z ] );
		if ( y === null ) continue;
		const p = toWorld( x, y - 0.05, z );
		lavender.clump( p.x, p.y, p.z, 0.28 + rand.next() * 0.12, rand );

	}

	// ---- colliders: the closed part of the house; under the arch the room is open (its back and its legs)
	const colliders = [];
	const box = ( x0, x1, z0, z1, y1 = 3.6 ) => colliders.push( { center: toWorld( ( x0 + x1 ) / 2, y1 / 2, ( z0 + z1 ) / 2 ), half: V( ( x1 - x0 ) / 2, y1 / 2, ( z1 - z0 ) / 2 ), yaw: h.yaw } );
	if ( s.loggia ) {

		const l = s.loggia;
		const ax0 = l.xc - l.S / 2, ax1 = l.xc + l.S / 2;
		if ( l.sg > 0 ) box( - s.L / 2 + 0.6, ax0 - 0.1, - s.D + 0.5, - 0.1 );
		else box( ax1 + 0.1, s.L / 2 - 0.6, - s.D + 0.5, - 0.1 );
		box( ax0, ax1, - s.D + 0.5, - l.Dl - 0.05 );
		// the inner leg (the outer one has the end arch through it)
		const leg = l.sg > 0 ? ax0 : ax1;
		box( leg - 0.3, leg + 0.3, - l.Dl, 0.4 );
		if ( ! l.side ) box( ( l.sg > 0 ? ax1 : ax0 ) - 0.3, ( l.sg > 0 ? ax1 : ax0 ) + 0.3, - l.Dl, 0.4 );

	} else box( - s.L / 2 + 0.6, s.L / 2 - 0.6, - s.D + 0.5, - 0.1 );

	const world = ( l ) => ( { position: toWorld( l.lx, l.ly, l.lz ), kind: l.kind } );
	return { lights: lights.map( world ), colliders, shape: s, extent: [ xl, xr ] };

}
