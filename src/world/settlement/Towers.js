import { Vector3 } from '../../engine/index.js';
import { Part } from '../village/GeoBuilder.js';

// The communal buildings: tall shells of the same pale stone, round in plan and rising in a catenary curve to
// a point (the "teardrop" halls of docs/REFERENCE.md). The shell is one parametric surface; every opening is
// a pointed arch in the surface's own coordinates, its vertices pushed in to the glazing, so the reveal is
// the shell's own thickness. Triangles that lie wholly inside an opening are glass (warm, lit), the rest
// coursed stone whose courses narrow toward the top.
//
// t: { x, z, r (base radius), h (height), yaw (direction of the main arch: 0 south) }, y0: ground height.

const CELL = 0.32; // m, shell grid
const DEPTH = 0.55; // recess of the glazing in the openings

// radius of the shell at height y: a catenary-like curve to a point, a slight flare at the foot
export function towerRadius( t, y ) {

	const u = Math.min( 1, Math.max( 0, y / t.h ) );
	return t.r * Math.pow( 1 - Math.pow( u, 1.65 ), 0.6 ) * ( 1 + 0.05 * Math.pow( 1 - u, 6 ) );

}

// the openings of a tower: around angle a (0 = the facing direction), from height y0, h tall, w wide
function openings( t ) {

	const H = t.h, R = t.r;
	return [
		{ a: 0, y0: 0, h: H * 0.43, w: R * 0.95 }, // the great arch
		{ a: Math.PI, y0: 0, h: H * 0.26, w: R * 0.6 }, // the back door
		{ a: 1.35, y0: 0, h: H * 0.2, w: R * 0.42 },
		{ a: - 1.35, y0: 0, h: H * 0.2, w: R * 0.42 },
		{ a: 0, y0: H * 0.5, h: H * 0.15, w: R * 0.42 }, // over the great arch
		{ a: 0.75, y0: H * 0.36, h: H * 0.12, w: R * 0.26 },
		{ a: - 0.75, y0: H * 0.36, h: H * 0.12, w: R * 0.26 },
		{ a: Math.PI * 0.8, y0: H * 0.42, h: H * 0.11, w: R * 0.24 },
		{ a: - Math.PI * 0.8, y0: H * 0.42, h: H * 0.11, w: R * 0.24 },
		{ a: 0, y0: H * 0.7, h: H * 0.08, w: R * 0.2 },
	];

}

// signed distance (m, + inside) of a point on the shell (angle th, height y, local radius r) to an opening's
// pointed-arch outline
function insideOpening( o, th, y, r ) {

	let da = th - o.a;
	da -= Math.PI * 2 * Math.round( da / ( Math.PI * 2 ) );
	const d = Math.abs( da ) * r; // along the surface
	const hw = o.w / 2;
	const ys = o.y0 + o.h - hw * 1.25; // where the arch head starts
	if ( y < o.y0 ) return o.y0 > 0.05 ? y - o.y0 : 1; // a door runs into the ground
	let half;
	if ( y <= ys ) half = hw;
	else {

		const q = ( y - ys ) / ( o.y0 + o.h - ys );
		if ( q >= 1 ) return - ( y - o.y0 - o.h );
		half = hw * Math.pow( 1 - Math.pow( q, 1.4 ), 0.65 );

	}

	return Math.min( half - d, o.y0 + o.h - y, o.y0 > 0.05 ? y - o.y0 : 99 );

}

export function buildTower( B, t, y0, rand ) {

	const H = t.h;
	const ops = openings( t );
	// profile samples by arc length so the courses are even along the curved surface
	const prof = [ { y: 0, r: towerRadius( t, 0 ), s: 0 } ];
	{

		const n = 400;
		for ( let i = 1; i <= n; i ++ ) {

			const y = H * i / n;
			const r = towerRadius( t, y );
			const p = prof[ prof.length - 1 ];
			prof.push( { y, r, s: p.s + Math.hypot( r - p.r, y - p.y ) } );

		}

	}

	const S = prof[ prof.length - 1 ].s;
	const rows = Math.ceil( S / CELL ), cols = Math.ceil( Math.PI * 2 * t.r / CELL );
	const at = ( s ) => {

		const f = s / S * ( prof.length - 1 );
		const i = Math.min( prof.length - 2, Math.floor( f ) ), k = f - i;
		return { y: prof[ i ].y + ( prof[ i + 1 ].y - prof[ i ].y ) * k, r: prof[ i ].r + ( prof[ i + 1 ].r - prof[ i ].r ) * k };

	};

	const P = [], N = [], UV = [], IN = [];
	for ( let j = 0; j <= rows; j ++ ) {

		const s = S * j / rows;
		const { y, r } = at( s );
		// profile tangent for the normal
		const a = at( Math.max( 0, s - 0.05 ) ), b = at( Math.min( S, s + 0.05 ) );
		let nr = b.y - a.y, ny = - ( b.r - a.r );
		const l = Math.hypot( nr, ny ) || 1;
		nr /= l; ny /= l;
		for ( let i = 0; i <= cols; i ++ ) {

			// seam at the back (th = PI)
			const th = - Math.PI + Math.PI * 2 * i / cols;
			let inside = - 1e9;
			for ( const o of ops ) inside = Math.max( inside, insideOpening( o, th, y, r ) );
			const k = Math.min( 1, Math.max( 0, inside / 0.22 + 0.5 ) );
			const rr = Math.max( 0.02, r - DEPTH * k * nr ) ;
			const yy = y - DEPTH * k * ny;
			// world: th = 0 faces the tower's yaw direction (local +z)
			const ca = Math.cos( th ), sa = Math.sin( th );
			P.push( sa * rr, yy, ca * rr );
			N.push( sa * nr, ny, ca * nr );
			UV.push( th * t.r * 0.85, s );
			IN.push( inside );

		}

	}

	const W = cols + 1;
	const stone = [], glass = [];
	for ( let j = 0; j < rows; j ++ ) for ( let i = 0; i < cols; i ++ ) {

		const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
		const tri = ( p, q, r ) => ( IN[ p ] > 0.12 && IN[ q ] > 0.12 && IN[ r ] > 0.12 ? glass : stone ).push( p, q, r );
		tri( a, c, d );
		tri( a, d, b );

	}

	const seed = rand.next();
	const sub = ( list ) => {

		// compact the vertices a triangle list uses
		const map = new Map();
		const p = [], n = [], uv = [], idx = [];
		for ( const v of list ) {

			let m = map.get( v );
			if ( m === undefined ) {

				m = p.length / 3;
				map.set( v, m );
				p.push( P[ v * 3 ], P[ v * 3 + 1 ], P[ v * 3 + 2 ] );
				n.push( N[ v * 3 ], N[ v * 3 + 1 ], N[ v * 3 + 2 ] );
				uv.push( UV[ v * 2 ], UV[ v * 2 + 1 ] );

			}

			idx.push( m );

		}

		return new Part( p, n, uv, idx );

	};

	B.part( 'stone', sub( stone ), t.x, y0, t.z, { ry: t.yaw, data: [ seed, 0, 0.3, 0 ], tint: [ 1.02, 1.0, 0.98 ] } );
	// glass in metres across the pane for the glazing material
	B.part( 'glazing', sub( glass ), t.x, y0, t.z, { ry: t.yaw, data: [ seed, 0.95, 0, 0 ] } );
	// a stone plinth ring round the foot, broken at the doors
	const n = 40;
	for ( let i = 0; i < n; i ++ ) {

		const th = - Math.PI + Math.PI * 2 * ( i + 0.5 ) / n;
		const r = towerRadius( t, 0.2 ) + 0.18;
		let door = false;
		for ( const o of ops ) if ( o.y0 < 0.05 && insideOpening( o, th, 0.3, r ) > - 0.3 ) door = true;
		if ( door ) continue;
		const c = Math.cos( th + 0 ), s = Math.sin( th );
		const lx = s * r, lz = c * r;
		const cy = Math.cos( t.yaw ), sy = Math.sin( t.yaw );
		B.box( 'stone', t.x + lx * cy + lz * sy, y0 + 0.12, t.z - lx * sy + lz * cy, Math.PI * 2 * r / n + 0.05, 0.5, 0.5, { ry: t.yaw + th, data: [ seed + i * 0.13, 3, 0.4, 1.2 ] } );

	}

	// light from within, out through the great arch
	const cy = Math.cos( t.yaw ), sy = Math.sin( t.yaw );
	return {
		lights: [ { position: new Vector3( t.x + sy * ( t.r - 1.2 ), y0 + 2.6, t.z + cy * ( t.r - 1.2 ) ), kind: 'window' } ],
		collider: { center: new Vector3( t.x, y0 + 3, t.z ), half: new Vector3( t.r * 0.72, 3, t.r * 0.72 ), yaw: t.yaw },
	};

}
