// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher 2012, "Distance Transforms of Sampled
// Functions"): two separable passes of the 1D lower envelope of parabolas.

const INF = 1e20;

function edt1d( f, n, d, v, z ) {

	let k = 0;
	v[ 0 ] = 0;
	z[ 0 ] = - INF;
	z[ 1 ] = INF;
	for ( let q = 1; q < n; q ++ ) {

		let s = ( ( f[ q ] + q * q ) - ( f[ v[ k ] ] + v[ k ] * v[ k ] ) ) / ( 2 * q - 2 * v[ k ] );
		while ( s <= z[ k ] ) {

			k --;
			s = ( ( f[ q ] + q * q ) - ( f[ v[ k ] ] + v[ k ] * v[ k ] ) ) / ( 2 * q - 2 * v[ k ] );

		}

		k ++;
		v[ k ] = q;
		z[ k ] = s;
		z[ k + 1 ] = INF;

	}

	k = 0;
	for ( let q = 0; q < n; q ++ ) {

		while ( z[ k + 1 ] < q ) k ++;
		const dq = q - v[ k ];
		d[ q ] = dq * dq + f[ v[ k ] ];

	}

}

// distance (in texels) from every texel of a w x h grid to the nearest texel where inside( k ) is true
export function distanceTo( w, h, inside ) {

	const n = Math.max( w, h );
	const f = new Float64Array( n ), d = new Float64Array( n ), z = new Float64Array( n + 1 );
	const v = new Int32Array( n );
	const out = new Float32Array( w * h );
	for ( let k = 0; k < w * h; k ++ ) out[ k ] = inside( k ) ? 0 : INF;
	// columns
	for ( let i = 0; i < w; i ++ ) {

		for ( let j = 0; j < h; j ++ ) f[ j ] = out[ j * w + i ];
		edt1d( f, h, d, v, z );
		for ( let j = 0; j < h; j ++ ) out[ j * w + i ] = d[ j ];

	}

	// rows
	for ( let j = 0; j < h; j ++ ) {

		const row = j * w;
		for ( let i = 0; i < w; i ++ ) f[ i ] = out[ row + i ];
		edt1d( f, w, d, v, z );
		for ( let i = 0; i < w; i ++ ) out[ row + i ] = Math.sqrt( d[ i ] );

	}

	return out;

}
