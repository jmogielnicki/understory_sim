// Signed distance fields and a mesher for them: the homes' soft, blended forms (plastered walls swelling into
// a planted roof, the open arch rolling through the shell) are described as distance functions and turned
// into triangles here, once, when the village is built.
//
// Fields are functions ( x, y, z ) -> distance (negative inside). They need not be exact distances: the
// mesher only relies on the sign, a gradient that points out, and |value| not much larger than the true
// distance (it skips space where |value| says the surface is far).

export const clamp = ( x, a, b ) => x < a ? a : x > b ? b : x;

// polynomial smooth minimum / maximum (k = blend radius, m)
export function smin( a, b, k ) {

	// (an infinite side has no say: and Infinity - Infinity would be NaN)
	if ( ! Number.isFinite( a ) || ! Number.isFinite( b ) ) return Math.min( a, b );
	const h = clamp( 0.5 + 0.5 * ( b - a ) / k, 0, 1 );
	return b + ( a - b ) * h - k * h * ( 1 - h );

}

export function smax( a, b, k ) {

	return - smin( - a, - b, k );

}

// 2d rounded rectangle centred on the origin: half sizes hx, hz, corner radius r
export function sdRoundRect( x, z, hx, hz, r ) {

	const qx = Math.abs( x ) - hx + r, qz = Math.abs( z ) - hz + r;
	const ox = Math.max( qx, 0 ), oz = Math.max( qz, 0 );
	return Math.hypot( ox, oz ) + Math.min( Math.max( qx, qz ), 0 ) - r;

}

// 2d ellipse (approximate distance: exact on the axes, never more than the true distance)
export function sdEllipse( x, y, a, b ) {

	const k0 = Math.hypot( x / a, y / b );
	if ( k0 < 1e-9 ) return - Math.min( a, b );
	const k1 = Math.hypot( x / ( a * a ), y / ( b * b ) );
	return k0 * ( k0 - 1 ) / k1;

}

// an arch-topped opening in a plane: width w, straight sides up to `spring`, then a half ellipse of rise r
export function sdArchOpening( x, y, w, spring, r ) {

	const hw = w / 2;
	if ( y <= spring ) return Math.max( Math.abs( x ) - hw, - y );
	return sdEllipse( x, y - spring, hw, r );

}

// value noise in 3d, -1..1 (smooth, cheap; for lumps and wobbles)
function hash3( i, j, k ) {

	let h = ( i * 374761393 + j * 668265263 + k * 1274126177 ) | 0;
	h = Math.imul( h ^ ( h >>> 13 ), 1274126177 );
	h ^= h >>> 16;
	return ( h & 0xffff ) / 0x8000 - 1;

}

export function noise3( x, y, z ) {

	const i = Math.floor( x ), j = Math.floor( y ), k = Math.floor( z );
	const fx = x - i, fy = y - j, fz = z - k;
	const u = fx * fx * ( 3 - 2 * fx ), v = fy * fy * ( 3 - 2 * fy ), w = fz * fz * ( 3 - 2 * fz );
	const a = hash3( i, j, k ), b = hash3( i + 1, j, k ), c = hash3( i, j + 1, k ), d = hash3( i + 1, j + 1, k );
	const e = hash3( i, j, k + 1 ), f = hash3( i + 1, j, k + 1 ), g = hash3( i, j + 1, k + 1 ), h = hash3( i + 1, j + 1, k + 1 );
	const x0 = a + ( b - a ) * u, x1 = c + ( d - c ) * u, x2 = e + ( f - e ) * u, x3 = g + ( h - g ) * u;
	const y0 = x0 + ( x1 - x0 ) * v, y1 = x2 + ( x3 - x2 ) * v;
	return y0 + ( y1 - y0 ) * w;

}

// scratch grids, grown as needed and shared by every mesh built
let VAL = new Float32Array( 0 );
let CELL = new Int32Array( 0 );

const BLOCK = 6;

// Surface nets over the box [ lo, hi ] with cells of size h: a vertex in every cell the surface crosses
// (the mean of the edge crossings, then pulled on to the surface along the gradient), a quad across every
// grid edge it crosses. Only blocks of cells near the surface are evaluated. Returns { p, n, idx } (vertex
// positions and normals as Float32Arrays, normals from the field's gradient; indices, wound outward).
export function meshField( f, lo, hi, h ) {

	const nx = Math.ceil( ( hi[ 0 ] - lo[ 0 ] ) / h ) + 1, ny = Math.ceil( ( hi[ 1 ] - lo[ 1 ] ) / h ) + 1, nz = Math.ceil( ( hi[ 2 ] - lo[ 2 ] ) / h ) + 1;
	const N = nx * ny * nz;
	if ( VAL.length < N ) {

		VAL = new Float32Array( N );
		CELL = new Int32Array( N );

	}

	const val = VAL, cell = CELL;
	val.fill( NaN, 0, N );
	cell.fill( - 1, 0, N );
	const sx = 1, sy = nx, sz = nx * ny;
	const at = ( i, j, k ) => {

		const id = i + j * sy + k * sz;
		let v = val[ id ];
		if ( v !== v ) v = val[ id ] = f( lo[ 0 ] + i * h, lo[ 1 ] + j * h, lo[ 2 ] + k * h );
		return v;

	};

	// blocks near the surface
	const bx = Math.ceil( ( nx - 1 ) / BLOCK ), by = Math.ceil( ( ny - 1 ) / BLOCK ), bz = Math.ceil( ( nz - 1 ) / BLOCK );
	const reach = BLOCK * h * 0.87 + h * 1.5;
	const active = [];
	for ( let k = 0; k < bz; k ++ ) for ( let j = 0; j < by; j ++ ) for ( let i = 0; i < bx; i ++ ) {

		const c = f( lo[ 0 ] + ( i + 0.5 ) * BLOCK * h, lo[ 1 ] + ( j + 0.5 ) * BLOCK * h, lo[ 2 ] + ( k + 0.5 ) * BLOCK * h );
		if ( Math.abs( c ) < reach ) active.push( i, j, k );

	}

	// vertices
	const P = [];
	const cells = [];
	for ( let b = 0; b < active.length; b += 3 ) {

		const i0 = active[ b ] * BLOCK, j0 = active[ b + 1 ] * BLOCK, k0 = active[ b + 2 ] * BLOCK;
		for ( let k = k0; k < Math.min( k0 + BLOCK, nz - 1 ); k ++ ) for ( let j = j0; j < Math.min( j0 + BLOCK, ny - 1 ); j ++ ) for ( let i = i0; i < Math.min( i0 + BLOCK, nx - 1 ); i ++ ) {

			const c = [ at( i, j, k ), at( i + 1, j, k ), at( i, j + 1, k ), at( i + 1, j + 1, k ), at( i, j, k + 1 ), at( i + 1, j, k + 1 ), at( i, j + 1, k + 1 ), at( i + 1, j + 1, k + 1 ) ];
			let mask = 0;
			for ( let q = 0; q < 8; q ++ ) if ( c[ q ] < 0 ) mask |= 1 << q;
			if ( mask === 0 || mask === 255 ) continue;
			// mean of the crossings on the cell's 12 edges
			let mx = 0, my = 0, mz = 0, m = 0;
			for ( const [ a, bb ] of EDGES ) {

				const va = c[ a ], vb = c[ bb ];
				if ( ( va < 0 ) === ( vb < 0 ) ) continue;
				const t = va / ( va - vb );
				mx += ( a & 1 ) + ( ( bb & 1 ) - ( a & 1 ) ) * t;
				my += ( ( a >> 1 ) & 1 ) + ( ( ( bb >> 1 ) & 1 ) - ( ( a >> 1 ) & 1 ) ) * t;
				mz += ( ( a >> 2 ) & 1 ) + ( ( ( bb >> 2 ) & 1 ) - ( ( a >> 2 ) & 1 ) ) * t;
				m ++;

			}

			cell[ i + j * sy + k * sz ] = P.length / 3;
			cells.push( i, j, k );
			P.push( lo[ 0 ] + ( i + mx / m ) * h, lo[ 1 ] + ( j + my / m ) * h, lo[ 2 ] + ( k + mz / m ) * h );

		}

	}

	// pull every vertex on to the surface (a Newton step along the gradient, no further than half a cell),
	// and take its normal from the gradient there
	const nv = P.length / 3;
	const pos = new Float32Array( nv * 3 ), nrm = new Float32Array( nv * 3 );
	const e = h * 0.2;
	for ( let v = 0; v < nv; v ++ ) {

		let x = P[ v * 3 ], y = P[ v * 3 + 1 ], z = P[ v * 3 + 2 ];
		let gx = 0, gy = 0, gz = 0;
		for ( let it = 0; it < 1; it ++ ) {

			const d = f( x, y, z );
			gx = f( x + e, y, z ) - f( x - e, y, z );
			gy = f( x, y + e, z ) - f( x, y - e, z );
			gz = f( x, y, z + e ) - f( x, y, z - e );
			const g2 = ( gx * gx + gy * gy + gz * gz ) / ( 4 * e * e );
			if ( g2 < 1e-8 ) break;
			let s = d / g2 / ( 2 * e );
			const step = Math.abs( s ) * Math.sqrt( g2 ) * 2 * e;
			if ( step > h * 0.5 ) s *= h * 0.5 / step;
			x -= gx * s; y -= gy * s; z -= gz * s;

		}

		// keep within reach of the cell it belongs to (thin features)
		const ci = cells[ v * 3 ], cj = cells[ v * 3 + 1 ], ck = cells[ v * 3 + 2 ];
		x = clamp( x, lo[ 0 ] + ( ci - 0.25 ) * h, lo[ 0 ] + ( ci + 1.25 ) * h );
		y = clamp( y, lo[ 1 ] + ( cj - 0.25 ) * h, lo[ 1 ] + ( cj + 1.25 ) * h );
		z = clamp( z, lo[ 2 ] + ( ck - 0.25 ) * h, lo[ 2 ] + ( ck + 1.25 ) * h );
		pos[ v * 3 ] = x; pos[ v * 3 + 1 ] = y; pos[ v * 3 + 2 ] = z;
		const l = Math.hypot( gx, gy, gz ) || 1;
		nrm[ v * 3 ] = gx / l; nrm[ v * 3 + 1 ] = gy / l; nrm[ v * 3 + 2 ] = gz / l;

	}

	// quads across the crossed grid edges (each edge from a cell's lowest corner, shared by four cells)
	const idx = [];
	const quad = ( a, b, c, d ) => {

		if ( a < 0 || b < 0 || c < 0 || d < 0 ) return;
		// split along the shorter diagonal; wind each triangle to face along the vertex normals
		const dac = dist2( pos, a, c ), dbd = dist2( pos, b, d );
		const tris = dac <= dbd ? [ a, b, c, a, c, d ] : [ a, b, d, b, c, d ];
		for ( let t = 0; t < 6; t += 3 ) {

			const p = tris[ t ], q = tris[ t + 1 ], r = tris[ t + 2 ];
			if ( faceDot( pos, nrm, p, q, r ) < 0 ) idx.push( p, r, q );
			else idx.push( p, q, r );

		}

	};

	for ( let v = 0; v < nv; v ++ ) {

		const i = cells[ v * 3 ], j = cells[ v * 3 + 1 ], k = cells[ v * 3 + 2 ];
		const c0 = val[ i + j * sy + k * sz ];
		const id = ( a, b, c ) => ( a < 0 || b < 0 || c < 0 ) ? - 1 : cell[ a + b * sy + c * sz ];
		// the edge along x from corner (i, j, k) is shared by the cells (i, j - 1..j, k - 1..k)
		if ( j > 0 && k > 0 && ( c0 < 0 ) !== ( val[ i + 1 + j * sy + k * sz ] < 0 ) ) quad( id( i, j - 1, k - 1 ), id( i, j, k - 1 ), id( i, j, k ), id( i, j - 1, k ) );
		if ( i > 0 && k > 0 && ( c0 < 0 ) !== ( val[ i + ( j + 1 ) * sy + k * sz ] < 0 ) ) quad( id( i - 1, j, k - 1 ), id( i, j, k - 1 ), id( i, j, k ), id( i - 1, j, k ) );
		if ( i > 0 && j > 0 && ( c0 < 0 ) !== ( val[ i + j * sy + ( k + 1 ) * sz ] < 0 ) ) quad( id( i - 1, j - 1, k ), id( i, j - 1, k ), id( i, j, k ), id( i - 1, j, k ) );

	}

	return { p: pos, n: nrm, idx };

}

// cell corners: bit 0 = +x, bit 1 = +y, bit 2 = +z
const EDGES = [ [ 0, 1 ], [ 2, 3 ], [ 4, 5 ], [ 6, 7 ], [ 0, 2 ], [ 1, 3 ], [ 4, 6 ], [ 5, 7 ], [ 0, 4 ], [ 1, 5 ], [ 2, 6 ], [ 3, 7 ] ];

function dist2( P, a, b ) {

	const dx = P[ a * 3 ] - P[ b * 3 ], dy = P[ a * 3 + 1 ] - P[ b * 3 + 1 ], dz = P[ a * 3 + 2 ] - P[ b * 3 + 2 ];
	return dx * dx + dy * dy + dz * dz;

}

function faceDot( P, N, a, b, c ) {

	const ux = P[ b * 3 ] - P[ a * 3 ], uy = P[ b * 3 + 1 ] - P[ a * 3 + 1 ], uz = P[ b * 3 + 2 ] - P[ a * 3 + 2 ];
	const vx = P[ c * 3 ] - P[ a * 3 ], vy = P[ c * 3 + 1 ] - P[ a * 3 + 1 ], vz = P[ c * 3 + 2 ] - P[ a * 3 + 2 ];
	const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
	return fx * ( N[ a * 3 ] + N[ b * 3 ] + N[ c * 3 ] ) + fy * ( N[ a * 3 + 1 ] + N[ b * 3 + 1 ] + N[ c * 3 + 1 ] ) + fz * ( N[ a * 3 + 2 ] + N[ b * 3 + 2 ] + N[ c * 3 + 2 ] );

}
