import { Vector2, Vector3 } from '../../engine/index.js';
import { triangulateShape } from '../../engine/math/ShapeUtils.js';
import { Part, lathePart } from '../village/GeoBuilder.js';

// An earth-sheltered home (see docs/REFERENCE.md): one broad vault and smaller ones beside it, dug into
// the hillside under a planted mound (the mound is the terrain itself, shaped by Grading.home), so that
// only the front shows: a headwall of pale coursed sandstone cut into the mound's face, a thick arch ring
// of voussoirs round every opening, standing proud of the wall, and set back under each arch a timber
// frame of glazing and glazed doors with the warm rooms behind. In front: a flagged terrace, retained by
// a stone wall where the slope falls away. On the roof: oval skylights in the meadow. Some door arches
// carry the pale blue seam of everyday technology.
//
// Local frame (Builder.pushAt( x, floorY, z, yaw )): x along the facade (to the right seen from the
// front), y up from the floor, +z out of the hill toward the view.
//
// Builder keys: 'stone' (vdata: seed, pattern, wear, w), 'glazing' (seed, lit, kind), 'wood' (the village
// wood material: seed, paint, pattern, weathering), 'glow' (phase), 'hard' (village hard: iron fittings).

export const RING = 0.62; // width of the arch ring (m)
export const PROUD = 0.16; // how far the ring stands out of the headwall
export const RECESS = 0.75; // the glazing set back from the ring's face
const SEGS = 28; // segments along each arch

const OAK = [ 0.62, 0.45, 0.3 ];

function part( p, n, uv, idx ) {

	return new Part( p, n, uv, idx );

}

// point on an arch: semi-ellipse with half span a and rise b, t = 0 at the right foot, PI at the left
const archPt = ( o, a, b, t ) => [ o + a * Math.cos( t ), b * Math.sin( t ) ];

// arc length along a semi-ellipse (for the voussoir uvs), sampled at SEGS + 1 points
function arcLengths( a, b ) {

	const L = [ 0 ];
	let prev = archPt( 0, a, b, 0 );
	for ( let i = 1; i <= SEGS; i ++ ) {

		const p = archPt( 0, a, b, Math.PI * i / SEGS );
		L.push( L[ i - 1 ] + Math.hypot( p[ 0 ] - prev[ 0 ], p[ 1 ] - prev[ 1 ] ) );
		prev = p;

	}

	return L;

}

// keep neighbouring arch rings apart (at least `gap` of wall between them)
export function settleArches( arches, gap = 0.45 ) {

	const sorted = arches.slice().sort( ( p, q ) => p.o - q.o );
	const main = sorted.findIndex( ( a ) => a.o === 0 );
	for ( let i = main + 1; i < sorted.length; i ++ ) {

		const p = sorted[ i - 1 ], q = sorted[ i ];
		const need = p.o + p.span / 2 + RING + gap + q.span / 2 + RING;
		if ( q.o < need ) q.o = need;

	}

	for ( let i = main - 1; i >= 0; i -- ) {

		const p = sorted[ i + 1 ], q = sorted[ i ];
		const need = p.o - p.span / 2 - RING - gap - q.span / 2 - RING;
		if ( q.o > need ) q.o = need;

	}

	return sorted;

}

// The headwall: the vertical stone face of the mound across the front, from below the terrace up to the
// mound's profile, open under every arch ring. top( lx ) = profile height above the floor.
function headwall( B, arches, top, seed, wear ) {

	// how far the face reaches: until the mound comes down to the terrace on either side
	const lo = arches[ 0 ].o - arches[ 0 ].span / 2 - RING, hi = arches[ arches.length - 1 ].o + arches[ arches.length - 1 ].span / 2 + RING;
	let xa = lo, xb = hi;
	while ( xa > lo - 8 && top( xa - 0.4 ) > 0.12 ) xa -= 0.4;
	while ( xb < hi + 8 && top( xb + 0.4 ) > 0.12 ) xb += 0.4;
	const base = - 0.45;
	const contour = [ new Vector2( xa, base ) ];
	for ( const a of arches ) {

		const A = a.span / 2 + RING, Bh = a.rise + RING;
		contour.push( new Vector2( a.o - A, base ) );
		for ( let i = SEGS; i >= 0; i -- ) {

			const [ x, y ] = archPt( a.o, A, Bh, Math.PI * i / SEGS );
			contour.push( new Vector2( x, Math.max( y, 0 ) ) );

		}

		contour.push( new Vector2( a.o + A, base ) );

	}

	contour.push( new Vector2( xb, base ) );
	// the top: the mound's profile, tucked a little under the soil
	const n = Math.max( 4, Math.ceil( ( xb - xa ) / 0.35 ) );
	for ( let i = n; i >= 0; i -- ) {

		const x = xa + ( xb - xa ) * i / n;
		let y = top( x ) + 0.12;
		// never below the arch rings it holds
		for ( const a of arches ) {

			const A = a.span / 2 + RING, Bh = a.rise + RING;
			const u = ( x - a.o ) / A;
			if ( Math.abs( u ) < 1 ) y = Math.max( y, Bh * Math.sqrt( 1 - u * u ) + 0.3 );

		}

		contour.push( new Vector2( x, Math.max( y, base + 0.2 ) ) );

	}

	// drop near-duplicates (the triangulator dislikes them)
	const clean = [];
	for ( const p of contour ) if ( ! clean.length || clean[ clean.length - 1 ].distanceTo( p ) > 1e-3 ) clean.push( p );
	const tris = triangulateShape( clean, [] );
	const p = [], nn = [], uv = [], idx = [];
	for ( const q of clean ) {

		p.push( q.x, q.y, 0 );
		nn.push( 0, 0, 1 );
		uv.push( q.x - xa, q.y - base );

	}

	for ( const t of tris ) idx.push( t[ 0 ], t[ 1 ], t[ 2 ] );
	// the triangulator's winding: make the face look out (+z)
	const a0 = clean[ idx[ 0 ] ], a1 = clean[ idx[ 1 ] ], a2 = clean[ idx[ 2 ] ];
	if ( ( a1.x - a0.x ) * ( a2.y - a0.y ) - ( a1.y - a0.y ) * ( a2.x - a0.x ) < 0 ) for ( let k = 0; k < idx.length; k += 3 ) [ idx[ k + 1 ], idx[ k + 2 ] ] = [ idx[ k + 2 ], idx[ k + 1 ] ];
	B.part( 'stone', part( p, nn, uv, idx ), 0, 0, 0, { data: [ seed, 0, wear, 0 ] } );
	// the wall is thick: its top runs back over the openings to the mound (covers the ground's cut there),
	// a capping course sloping gently back into the soil
	// a narrow stone coping at the front, then turf running back into the roof meadow
	const strip = ( z0, z1, y1, pattern, w ) => {

		const cap = [], cn = [], cu = [], ci = [];
		for ( let i = 0; i <= n; i ++ ) {

			const q = clean[ clean.length - 1 - ( n - i ) ];
			cap.push( q.x, q.y - ( z0 < - 0.01 ? 0.04 : 0 ), z0, q.x, q.y - y1, z1 );
			cn.push( 0, 0.99, 0.12, 0, 0.99, 0.12 );
			cu.push( q.x - xa, 0, q.x - xa, z0 - z1 );
			if ( i > 0 ) {

				const b = i * 2;
				ci.push( b - 2, b - 1, b + 1, b - 2, b + 1, b );

			}

		}

		B.part( 'stone', part( cap, cn, cu, ci ), 0, 0, 0, { data: [ seed + 0.5, pattern, w, 0 ] } );

	};

	strip( 0.02, - 0.4, 0.04, 1, Math.min( 1, wear + 0.3 ) );
	strip( - 0.4, - 3.3, 0.3, 7, 0 );
	return { xa, xb };

}

// the arch ring: face, outer edge (against the headwall) and soffit back to the glazing
function ring( B, a, seed, wear ) {

	const ai = a.span / 2, bi = a.rise, ao = ai + RING, bo = bi + RING;
	const Lm = arcLengths( ( ai + ao ) / 2, ( bi + bo ) / 2 );
	const Li = arcLengths( ai, bi );
	const p = [], n = [], uv = [], idx = [];
	const quad = ( v0, v1, v2, v3 ) => {

		const b = p.length / 3;
		for ( const v of [ v0, v1, v2, v3 ] ) {

			p.push( v.p[ 0 ], v.p[ 1 ], v.p[ 2 ] );
			n.push( v.n[ 0 ], v.n[ 1 ], v.n[ 2 ] );
			uv.push( v.uv[ 0 ], v.uv[ 1 ] );

		}

		idx.push( b, b + 1, b + 2, b, b + 2, b + 3 );

	};

	for ( let i = 0; i < SEGS; i ++ ) {

		const t0 = Math.PI * i / SEGS, t1 = Math.PI * ( i + 1 ) / SEGS;
		const [ ix0, iy0 ] = archPt( a.o, ai, bi, t0 ), [ ix1, iy1 ] = archPt( a.o, ai, bi, t1 );
		const [ ox0, oy0 ] = archPt( a.o, ao, bo, t0 ), [ ox1, oy1 ] = archPt( a.o, ao, bo, t1 );
		// face (z = PROUD), facing +z; u along the arch, v across the ring
		quad(
			{ p: [ ix0, iy0, PROUD ], n: [ 0, 0, 1 ], uv: [ Lm[ i ], 0 ] },
			{ p: [ ox0, oy0, PROUD ], n: [ 0, 0, 1 ], uv: [ Lm[ i ], RING ] },
			{ p: [ ox1, oy1, PROUD ], n: [ 0, 0, 1 ], uv: [ Lm[ i + 1 ], RING ] },
			{ p: [ ix1, iy1, PROUD ], n: [ 0, 0, 1 ], uv: [ Lm[ i + 1 ], 0 ] },
		);
		// outer edge, from the headwall out to the face (normal: away from the opening)
		const on0 = [ Math.cos( t0 ) / ao, Math.sin( t0 ) / bo ], on1 = [ Math.cos( t1 ) / ao, Math.sin( t1 ) / bo ];
		const l0 = Math.hypot( ...on0 ), l1 = Math.hypot( ...on1 );
		quad(
			{ p: [ ox0, oy0, 0 ], n: [ on0[ 0 ] / l0, on0[ 1 ] / l0, 0 ], uv: [ Lm[ i ], 0 ] },
			{ p: [ ox1, oy1, 0 ], n: [ on1[ 0 ] / l1, on1[ 1 ] / l1, 0 ], uv: [ Lm[ i + 1 ], 0 ] },
			{ p: [ ox1, oy1, PROUD ], n: [ on1[ 0 ] / l1, on1[ 1 ] / l1, 0 ], uv: [ Lm[ i + 1 ], PROUD ] },
			{ p: [ ox0, oy0, PROUD ], n: [ on0[ 0 ] / l0, on0[ 1 ] / l0, 0 ], uv: [ Lm[ i ], PROUD ] },
		);
		// soffit: the inner face, from the ring's face back to the glazing (normal: into the opening)
		const in0 = [ - Math.cos( t0 ) / ai, - Math.sin( t0 ) / bi ], in1 = [ - Math.cos( t1 ) / ai, - Math.sin( t1 ) / bi ];
		const m0 = Math.hypot( ...in0 ), m1 = Math.hypot( ...in1 );
		quad(
			{ p: [ ix0, iy0, PROUD ], n: [ in0[ 0 ] / m0, in0[ 1 ] / m0, 0 ], uv: [ Li[ i ], 0 ] },
			{ p: [ ix1, iy1, PROUD ], n: [ in1[ 0 ] / m1, in1[ 1 ] / m1, 0 ], uv: [ Li[ i + 1 ], 0 ] },
			{ p: [ ix1, iy1, - RECESS ], n: [ in1[ 0 ] / m1, in1[ 1 ] / m1, 0 ], uv: [ Li[ i + 1 ], RECESS + PROUD ] },
			{ p: [ ix0, iy0, - RECESS ], n: [ in0[ 0 ] / m0, in0[ 1 ] / m0, 0 ], uv: [ Li[ i ], RECESS + PROUD ] },
		);

	}

	// the springers: a footing block under each foot of the ring
	B.box( 'stone', a.o - ai - RING / 2, - 0.12, PROUD / 2 - 0.02, RING + 0.12, 0.3, PROUD + 0.32, { data: [ seed + 0.3, 3, wear, RING ] } );
	B.box( 'stone', a.o + ai + RING / 2, - 0.12, PROUD / 2 - 0.02, RING + 0.12, 0.3, PROUD + 0.32, { data: [ seed + 0.6, 3, wear, RING ] } );
	// the pieces of a ring are fixed: face and soffit get the voussoir pattern
	const pr = part( p, n, uv, idx );
	B.part( 'stone', pr, 0, 0, 0, { data: [ seed, 2, wear, 0 ] } );

}

// The glazing under an arch: a curved timber head following the opening, mullions, a transom at door
// height, glazed doors in the middle bay (kind 'door'), or a low stone sill wall and windows ('window').
function glazing( B, a, rand, { kind, lit, seed } ) {

	const ai = a.span / 2, bi = a.rise;
	const z = - RECESS;
	const yAt = ( x ) => {

		const u = ( x - a.o ) / ai;
		return Math.abs( u ) >= 1 ? 0 : bi * Math.sqrt( 1 - u * u );

	};

	const sill = kind === 'window' ? 0.75 : 0;
	if ( sill > 0 ) {

		// the low wall under the windows, with a dressed sill on top
		const p = [], n = [], uv = [], idx = [];
		const N = 12;
		for ( let i = 0; i <= N; i ++ ) {

			const x = a.o - ai + 2 * ai * i / N;
			const y = Math.min( sill, yAt( x ) );
			p.push( x, - 0.3, z + 0.02, x, y, z + 0.02 );
			n.push( 0, 0, 1, 0, 0, 1 );
			uv.push( x - a.o + ai, 0, x - a.o + ai, y + 0.3 );

		}

		for ( let i = 0; i < N; i ++ ) idx.push( i * 2, i * 2 + 2, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 1 );
		B.part( 'stone', part( p, n, uv, idx ), 0, 0, 0, { data: [ seed + 0.17, 0, 0.2, 0 ] } );
		const w = 2 * Math.sqrt( Math.max( 0, 1 - ( sill / bi ) ** 2 ) ) * ai;
		B.box( 'stone', a.o, sill + 0.04, z + 0.12, w + 0.08, 0.08, 0.36, { data: [ seed + 0.21, 3, 0.15, w ] } );

	}

	// timber head along the opening (just inside the soffit)
	const fw = 0.13, fd = 0.16;
	for ( let i = 0; i < SEGS; i ++ ) {

		const [ x0, y0 ] = archPt( a.o, ai - fw / 2, bi - fw / 2, Math.PI * i / SEGS );
		const [ x1, y1 ] = archPt( a.o, ai - fw / 2, bi - fw / 2, Math.PI * ( i + 1 ) / SEGS );
		if ( y0 < sill - 0.05 && y1 < sill - 0.05 ) continue;
		B.beam( 'wood', [ x0, Math.max( y0, sill ), z ], [ x1, Math.max( y1, sill ), z ], fd, fw, { extend: 0.03, data: [ rand.next(), 0, 0, 0.35 ], tint: OAK } );

	}

	// bays: mullions every ~1.2 m; the middle two bays of a door arch are the doors
	const inner = 2 * ( ai - fw );
	const bays = Math.max( 2, Math.round( inner / 1.25 ) );
	const doorBays = kind === 'door' ? ( bays % 2 === 0 ? [ bays / 2 - 1, bays / 2 ] : [ ( bays - 1 ) / 2 ] ) : [];
	const transom = Math.min( 2.25, bi * 0.62 );
	const xs = [];
	for ( let k = 0; k <= bays; k ++ ) xs.push( a.o - ai + fw + inner * k / bays );
	for ( let k = 1; k < bays; k ++ ) {

		const x = xs[ k ];
		const top = yAt( x ) - fw * 0.5;
		const isDoorEdge = doorBays.includes( k ) || doorBays.includes( k - 1 );
		B.box( 'wood', x, ( sill + top ) / 2, z, isDoorEdge ? 0.11 : 0.075, top - sill, fd, { data: [ rand.next(), 0, 0, 0.35 ], tint: OAK } );

	}

	// transom across where the opening is tall enough
	{

		const half = ai * Math.sqrt( Math.max( 0, 1 - ( transom / bi ) ** 2 ) ) - fw;
		if ( half > 0.3 && transom > sill + 0.5 ) B.box( 'wood', a.o, transom, z, half * 2, 0.09, fd, { data: [ rand.next(), 0, 0, 0.35 ], tint: OAK } );

	}

	// a bottom rail and the panes
	B.box( 'wood', a.o, sill + 0.04, z, inner, 0.08, fd, { data: [ rand.next(), 0, 0, 0.35 ], tint: OAK } );
	for ( let k = 0; k < bays; k ++ ) {

		const x0 = xs[ k ] + 0.04, x1 = xs[ k + 1 ] - 0.04;
		const door = doorBays.includes( k );
		// lower pane (door leaf: a glazed timber door with a kick rail) and upper pane to the arch
		const bands = [ [ sill + 0.08, transom - 0.045 ], [ transom + 0.045, 99 ] ];
		for ( const [ y0, y1cap ] of bands ) {

			const pts = [];
			const N = 6;
			let any = false;
			for ( let i = 0; i <= N; i ++ ) {

				const x = x0 + ( x1 - x0 ) * i / N;
				const yt = Math.min( y1cap, yAt( x ) - fw );
				if ( yt > y0 + 0.05 ) any = true;
				pts.push( [ x, Math.max( y0, yt ) ] );

			}

			if ( ! any ) continue;
			const p = [], n = [], uv = [], idx = [];
			for ( let i = 0; i <= N; i ++ ) {

				const [ x, yt ] = pts[ i ];
				p.push( x, y0, z - 0.02, x, yt, z - 0.02 );
				n.push( 0, 0, 1, 0, 0, 1 );
				uv.push( x - a.o, y0, x - a.o, yt );

			}

			for ( let i = 0; i < N; i ++ ) idx.push( i * 2, i * 2 + 2, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 1 );
			B.part( 'glazing', part( p, n, uv, idx ), 0, 0, 0, { data: [ seed + k * 0.13, lit, door ? 1 : 0, 0 ] } );

		}

		if ( door ) {

			// door leaf frame: kick rail and a handle
			const cx = ( x0 + x1 ) / 2;
			B.box( 'wood', cx, 0.22, z + 0.02, x1 - x0, 0.36, fd * 0.8, { data: [ rand.next(), 0, 0, 0.35 ], tint: OAK } );
			const hx = k === doorBays[ 0 ] && doorBays.length > 1 ? x1 - 0.1 : x0 + 0.1;
			B.box( 'hard', hx, 1.05, z + 0.1, 0.03, 0.28, 0.04, { data: [ rand.next(), 0, 0, 0 ], tint: [ 0.25, 0.22, 0.2 ] } );

		}

	}

	// threshold: one dressed stone across the opening
	B.box( 'stone', a.o, - 0.06, z + ( RECESS + PROUD ) / 2, 2 * ai, 0.14, RECESS + PROUD + 0.05, { data: [ seed + 0.41, 3, 0.2, 2 * ai ] } );

}

// the pale blue seam: a thin glowing line set into the ring's inner edge
function seam( B, a, phase ) {

	const ai = a.span / 2 + 0.06, bi = a.rise + 0.06;
	const pts = [];
	for ( let i = 0; i <= SEGS; i ++ ) {

		const [ x, y ] = archPt( a.o, ai, bi, Math.PI * i / SEGS );
		pts.push( new Vector3( x, y, PROUD + 0.004 ) );

	}

	for ( let i = 0; i < SEGS; i ++ ) {

		const p0 = pts[ i ], p1 = pts[ i + 1 ];
		B.beam( 'glow', [ p0.x, p0.y, p0.z ], [ p1.x, p1.y, p1.z ], 0.012, 0.035, { extend: 0.01, data: [ phase, 0, 0, 0 ], tint: [ 0.42, 0.78, 1.0 ] } );

	}

}

// a terrace wall strip along a local edge p0 -> p1 (out: unit outward normal in xz), top at the floor
// (+ parapet), bottom at the ground just outside; only where the ground has fallen away
function terraceWall( B, p0, p1, out, groundAt, seed, parapet ) {

	const L = Math.hypot( p1[ 0 ] - p0[ 0 ], p1[ 1 ] - p0[ 1 ] );
	const N = Math.max( 2, Math.ceil( L / 0.5 ) );
	const pos = [], nrm = [], uv = [], idx = [];
	let any = false;
	const t = 0.4;
	const cols = [];
	for ( let i = 0; i <= N; i ++ ) {

		const s = i / N;
		const x = p0[ 0 ] + ( p1[ 0 ] - p0[ 0 ] ) * s, z = p0[ 1 ] + ( p1[ 1 ] - p0[ 1 ] ) * s;
		const g = groundAt( x + out[ 0 ] * 0.9, z + out[ 1 ] * 0.9 );
		cols.push( { x, z, g, s } );
		if ( g < - 0.25 ) any = true;

	}

	if ( ! any ) return;
	for ( let i = 0; i <= N; i ++ ) {

		const c = cols[ i ];
		const top = c.g < - 0.6 ? parapet : 0.02;
		const bot = Math.min( c.g - 0.35, - 0.2 );
		const fx = c.x + out[ 0 ] * t, fz = c.z + out[ 1 ] * t;
		pos.push( fx, bot, fz, fx, top, fz );
		nrm.push( out[ 0 ], 0, out[ 1 ], out[ 0 ], 0, out[ 1 ] );
		uv.push( c.s * L, bot, c.s * L, top );
		c.top = top;

	}

	for ( let i = 0; i < N; i ++ ) idx.push( i * 2, i * 2 + 2, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 1 );
	B.part( 'stone', part( pos, nrm, uv, idx ), 0, 0, 0, { data: [ seed, 0, 0.45, 0 ] } );
	// coping on the parapet stretches
	for ( let i = 0; i < N; i ++ ) {

		const c0 = cols[ i ], c1 = cols[ i + 1 ];
		if ( c0.top > 0.1 || c1.top > 0.1 ) {

			const x0 = c0.x + out[ 0 ] * t * 0.5, z0 = c0.z + out[ 1 ] * t * 0.5, x1 = c1.x + out[ 0 ] * t * 0.5, z1 = c1.z + out[ 1 ] * t * 0.5;
			B.beam( 'stone', [ x0, parapet + 0.05, z0 ], [ x1, parapet + 0.05, z1 ], t + 0.08, 0.1, { extend: 0.02, data: [ seed + i * 0.07, 3, 0.3, L / N ] } );
			B.beam( 'stone', [ c0.x + out[ 0 ] * 0.02, parapet / 2, c0.z + out[ 1 ] * 0.02 ], [ c1.x + out[ 0 ] * 0.02, parapet / 2, c1.z + out[ 1 ] * 0.02 ], 0.06, parapet, { data: [ seed + 0.5, 0, 0.3, 0 ] } );

		}

	}

}

// oval skylight: a low glass dome in a stone ring, sitting on the mound
function skylight( B, x, y, z, r, yaw, seed ) {

	const rim = [ [ r + 0.22, - 0.25 ], [ r + 0.22, 0.08 ], [ r + 0.05, 0.14 ], [ r, 0.1 ] ];
	B.lathe( 'stone', x, y, z, rim, { segs: 20, ry: yaw, sx: 1.55, data: [ seed, 3, 0.4, 1 ] } );
	const dome = [];
	for ( let i = 0; i <= 6; i ++ ) {

		const t = i / 6;
		dome.push( [ r * Math.cos( t * Math.PI / 2 ), 0.1 + 0.32 * Math.sin( t * Math.PI / 2 ) ] );

	}

	B.part( 'glazing', lathePart( dome, 20 ), x, y, z, { ry: yaw, sx: 1.55, data: [ seed, 0.6, 2, 0 ] } );

}

// Build one home into the builder. g: Grading.home() result. Returns the light sources and the collider
// boxes (local), for the settlement to register.
export function buildEarthHome( B, h, g, rand, groundAt, drapes = null, plantings = null ) {

	const arches = settleArches( g.arches.map( ( a ) => ( { ...a } ) ) );
	const seed = rand.next();
	const wear = 0.35 + rand.next() * 0.4;
	const tint = [ 0.97 + rand.next() * 0.06, 0.97 + rand.next() * 0.03, 0.95 + rand.next() * 0.05 ];
	const floorY = g.floorY;
	const top = ( lx ) => g.frontTop( lx ) - floorY;
	B.pushAt( h.x, floorY, h.z, h.yaw );
	const { xa, xb } = headwall( B, arches, top, seed, wear );
	const lights = [];
	arches.forEach( ( a, i ) => {

		ring( B, a, seed + i * 0.31, wear );
		const main = a.o === 0;
		glazing( B, a, rand, { kind: main ? 'door' : 'window', lit: rand.range( 0.55, 1.0 ), seed: seed + i * 0.77 } );
		if ( main && h.seam ) seam( B, a, rand.next() );
		lights.push( { lx: a.o, ly: Math.min( a.rise * 0.55, 2.2 ), lz: - RECESS + 0.6, kind: 'window' } );

	} );

	// trailing vines from the roof meadow over the arch crowns and the wall tops
	const c0 = Math.cos( h.yaw ), s0 = Math.sin( h.yaw );
	const toWorld = ( lx, ly, lz ) => new Vector3( h.x + lx * c0 + lz * s0, floorY + ly, h.z - lx * s0 + lz * c0 );
	const facing = new Vector3( s0, 0, c0 );
	if ( drapes ) {

		for ( let x = xa + 0.4; x < xb - 0.3; x += 0.3 + rand.next() * 0.45 ) {

			// over an arch: more strands near its crown, fewer toward its feet
			let over = null;
			for ( const a of arches ) if ( Math.abs( x - a.o ) < a.span / 2 + RING ) over = a;
			const yTop = top( x ) + 0.1;
			if ( yTop < 0.8 ) continue;
			const crown = over ? 1 - Math.abs( x - over.o ) / ( over.span / 2 + RING ) : 0.3;
			if ( rand.next() > 0.25 + crown * 0.6 ) continue;
			const len = Math.min( yTop - 0.6, 0.4 + rand.next() * ( 0.8 + crown * 1.4 ) );
			drapes.strand( toWorld( x, yTop, PROUD + 0.06 ), facing, len, 0.5 + rand.next() * 0.45, rand.next(), 0.08 );

		}

	}

	// pots of plants on the terrace: by the wall between the arches and at the corners
	if ( plantings ) {

		const spots = [];
		for ( let i = 0; i < arches.length - 1; i ++ ) spots.push( [ ( arches[ i ].o + arches[ i ].span / 2 + arches[ i + 1 ].o - arches[ i + 1 ].span / 2 ) / 2, 0.7 ] );
		spots.push( [ g.xl - 0.1, g.terrace - 0.6 ], [ g.xr + 0.1, g.terrace - 0.6 ], [ arches[ 0 ].o - arches[ 0 ].span / 2 - 0.3, 0.75 ] );
		for ( const [ lx, lz ] of spots ) {

			if ( rand.next() < 0.25 ) continue;
			const r = 0.24 + rand.next() * 0.16, hgt = r * ( 1.4 + rand.next() * 0.6 );
			const p = toWorld( lx, 0, lz );
			B.lathe( 'stone', p.x, p.y, p.z, [ [ r * 0.72, 0 ], [ r, hgt * 0.92 ], [ r * 1.1, hgt * 0.95 ], [ r * 1.1, hgt ], [ r * 0.92, hgt ] ], { segs: 14, data: [ rand.next(), 6, 0, 0 ] } );
			B.lathe( 'stone', p.x, p.y + hgt - 0.06, p.z, [ [ r * 0.92, 0 ], [ 0.01, 0.02 ] ], { segs: 14, data: [ rand.next(), 4, 0, 0 ] } );
			plantings.push( { x: p.x, z: p.z, y: p.y + hgt - 0.05, s: r * 1.6, kind: rand.next() < 0.6 ? 'shrub' : 'fern' } );

		}

	}

	// outdoor living on the terrace (the references: a timber table and chairs before an arch, a bench against
	// the wall)
	const table = ( lx, lz, yaw, n ) => {

		B.pushAt( lx, 0, lz, yaw );
		const W = 1.7, D = 0.85, H = 0.76;
		const wood = { data: [ rand.next(), 0, 6, 0.45 ], tint: OAK };
		B.box( 'wood', 0, H - 0.025, 0, W, 0.05, D, wood );
		for ( const [ x, z ] of [ [ - W / 2 + 0.1, - D / 2 + 0.1 ], [ W / 2 - 0.1, - D / 2 + 0.1 ], [ - W / 2 + 0.1, D / 2 - 0.1 ], [ W / 2 - 0.1, D / 2 - 0.1 ] ] ) B.box( 'wood', x, H / 2 - 0.02, z, 0.07, H - 0.05, 0.07, wood );
		// chairs: seat, four legs, a ladder back
		const chair = ( x, z, ry ) => {

			B.pushAt( x, 0, z, ry );
			B.box( 'wood', 0, 0.45, 0, 0.44, 0.04, 0.42, wood );
			for ( const [ a, b ] of [ [ - 0.19, - 0.18 ], [ 0.19, - 0.18 ], [ - 0.19, 0.18 ], [ 0.19, 0.18 ] ] ) B.box( 'wood', a, 0.22, b, 0.04, 0.44, 0.04, wood );
			for ( const a of [ - 0.19, 0.19 ] ) B.box( 'wood', a, 0.7, - 0.19, 0.04, 0.5, 0.04, wood );
			for ( const y of [ 0.62, 0.78, 0.92 ] ) B.box( 'wood', 0, y, - 0.19, 0.38, 0.05, 0.025, wood );
			B.pop();

		};

		const seats = [ [ - 0.45, - 0.75, 0 ], [ 0.45, - 0.75, 0 ], [ - 0.45, 0.75, Math.PI ], [ 0.45, 0.75, Math.PI ], [ - 1.15, 0, Math.PI / 2 ], [ 1.15, 0, - Math.PI / 2 ] ];
		for ( let i = 0; i < n; i ++ ) {

			const [ x, z, r ] = seats[ i ];
			chair( x + ( rand.next() - 0.5 ) * 0.1, z, r + ( rand.next() - 0.5 ) * 0.3 );

		}

		B.pop();

	};

	if ( rand.next() < 0.7 ) {

		// before a side arch if there is one, else to one side of the doors
		const side = arches.find( ( a ) => a.o !== 0 );
		const lx = side ? side.o : ( rand.next() < 0.5 ? - 1 : 1 ) * ( arches[ 0 ].span / 2 + 0.5 );
		B.pushAt( h.x, floorY, h.z, h.yaw );
		table( lx, Math.min( g.terrace - 1.4, 2.3 ), ( rand.next() - 0.5 ) * 0.2, 3 + Math.floor( rand.next() * 3 ) );
		B.pop();

	}

	if ( rand.next() < 0.5 && arches.length > 1 ) {

		// a bench against the wall between two arches
		const a0 = arches[ 0 ], a1 = arches[ 1 ];
		const mid = ( a0.o + Math.sign( a1.o - a0.o ) * ( a0.span / 2 + RING ) + a1.o - Math.sign( a1.o - a0.o ) * ( a1.span / 2 + RING ) ) / 2;
		B.pushAt( h.x, floorY, h.z, h.yaw );
		B.pushAt( mid + ( rand.next() - 0.5 ) * 0.2, 0, 0.55, 0 );
		const wood = { data: [ rand.next(), 0, 6, 0.5 ], tint: OAK };
		B.box( 'wood', 0, 0.44, 0, 1.4, 0.05, 0.38, wood );
		for ( const x of [ - 0.6, 0.6 ] ) B.box( 'stone', x, 0.21, 0, 0.16, 0.42, 0.34, { data: [ rand.next(), 3, 0.4, 0.16 ] } );
		B.pop();
		B.pop();

	}

	// a planted bank below the terrace's front wall: shrubs and ferns along its foot
	if ( plantings ) {

		for ( let lx = g.xl; lx < g.xr; lx += 1.4 + rand.next() * 1.2 ) {

			if ( rand.next() < 0.3 ) continue;
			const lz = g.terrace + 0.9 + rand.next() * 0.9;
			const p = toWorld( lx, 0, lz );
			plantings.push( { x: p.x, z: p.z, y: groundAt( p.x, p.z ) - 0.05, s: 0.7 + rand.next() * 0.5, kind: rand.next() < 0.5 ? 'shrub' : 'fern' } );

		}

	}

	// terrace: flags from the headwall out, and inside the openings back to the glazing
	const tx0 = g.xl - 0.6, tx1 = g.xr + 0.6, td = g.terrace;
	B.slab( 'stone', [ new Vector3( tx0, 0, td ), new Vector3( tx1, 0, td ), new Vector3( tx1, 0, - RECESS ), new Vector3( tx0, 0, - RECESS ) ], 0.3, { data: [ seed + 0.9, 1, wear * 0.6, 0 ], up: new Vector3( 0, 1, 0 ) } );
	// retaining walls round the terrace where the ground falls away
	const ground = ( lx, lz ) => {

		const c = Math.cos( h.yaw ), s = Math.sin( h.yaw );
		return groundAt( h.x + lx * c + lz * s, h.z - lx * s + lz * c ) - floorY;

	};

	terraceWall( B, [ tx0, td ], [ tx1, td ], [ 0, 1 ], ground, seed + 0.11, 0.42 );
	terraceWall( B, [ tx1, td ], [ tx1, 0.3 ], [ 1, 0 ], ground, seed + 0.13, 0.42 );
	terraceWall( B, [ tx0, 0.3 ], [ tx0, td ], [ - 1, 0 ], ground, seed + 0.17, 0.42 );
	B.pop();

	// skylights on the roof, over the back rooms
	const c = Math.cos( h.yaw ), s = Math.sin( h.yaw );
	const n = h.skylights ?? 0;
	for ( let i = 0; i < n; i ++ ) {

		const lx = ( n === 1 ? 0 : ( i / ( n - 1 ) - 0.5 ) * Math.min( g.xr - g.xl - 3, 9 ) ) + rand.range( - 0.5, 0.5 );
		const lz = - h.depth * rand.range( 0.45, 0.7 );
		const wx = h.x + lx * c + lz * s, wz = h.z - lx * s + lz * c;
		skylight( B, wx, groundAt( wx, wz ) - 0.04, wz, rand.range( 0.55, 0.8 ), h.yaw + rand.range( - 0.2, 0.2 ), rand.next() );

	}

	const world = ( lx, ly, lz ) => new Vector3( h.x + lx * c + lz * s, floorY + ly, h.z - lx * s + lz * c );
	return {
		lights: lights.map( ( l ) => ( { position: world( l.lx, l.ly, l.lz ), kind: l.kind } ) ),
		extent: [ xa, xb ],
		// solid: the face and what is behind it (the rooms are not walkable yet)
		collider: { center: world( ( xa + xb ) / 2, 2, - 2.4 ), half: new Vector3( ( xb - xa ) / 2, 2.2, 2.4 + PROUD ), yaw: h.yaw },
	};

}
