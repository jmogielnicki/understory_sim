// Footpaths: x, z polylines (m) with half widths, worn into the ground (darkened, slightly sunken)
// and kept clear of plants and debris. The village adds its own paths here when it is laid out.
export const PATHS = [];

// distance from (x, z) to a polyline; returns [distance, arc length position of the closest point]
export function polylineDistance( pts, x, z ) {

	let best = Infinity, acc = 0, bestArc = 0;
	for ( let k = 0; k < pts.length - 1; k ++ ) {

		const a = pts[ k ], b = pts[ k + 1 ];
		const abx = b[ 0 ] - a[ 0 ], abz = b[ 1 ] - a[ 1 ];
		const len2 = abx * abx + abz * abz;
		let t = ( ( x - a[ 0 ] ) * abx + ( z - a[ 1 ] ) * abz ) / len2;
		t = t < 0 ? 0 : t > 1 ? 1 : t;
		const dx = x - ( a[ 0 ] + abx * t ), dz = z - ( a[ 1 ] + abz * t );
		const d = dx * dx + dz * dz;
		const len = Math.sqrt( len2 );
		if ( d < best ) {

			best = d;
			bestArc = acc + t * len;

		}

		acc += len;

	}

	return [ Math.sqrt( best ), bestArc ];

}
