import { smoothstep, clamp, lerp } from '../../util/Noise.js';
import { boxBlur } from '../terrain/TerrainNoise.js';
import { polylineDistance } from '../terrain/Paths.js';

// Earthworks for the village, done on the near heightmap before anything else reads it (the terrain mesh,
// the GPU maps, the plants): the lawn of the green and the plaza smoothed, paths levelled across, the stream
// channel and the pond basin dug, and for every home a level terrace in front and the planted mound over
// its vault, blending back into the hillside. The masks follow: open ground (meadow) on the roofs, the green
// and around the homes, no bare rock or beach sand where the ground was worked, worn paths.
//
// All work is in world metres on TerrainData's near grid (texel centres at origin + i + 0.5).

export function texelRange( T, x0, z0, x1, z1 ) {

	const { res, origin, texel } = T;
	return [
		Math.max( 1, Math.floor( ( x0 - origin ) / texel ) ), Math.min( res - 2, Math.ceil( ( x1 - origin ) / texel ) ),
		Math.max( 1, Math.floor( ( z0 - origin ) / texel ) ), Math.min( res - 2, Math.ceil( ( z1 - origin ) / texel ) ),
	];

}

// local frame of a placed object: toW( lx, lz ) -> world xz, toL( x, z ) -> local
export function frame( x, z, yaw ) {

	const c = Math.cos( yaw ), s = Math.sin( yaw );
	return {
		toW: ( lx, lz ) => [ x + lx * c + lz * s, z - lx * s + lz * c ],
		toL: ( wx, wz ) => {

			const dx = wx - x, dz = wz - z;
			return [ dx * c - dz * s, dx * s + dz * c ];

		},
	};

}

export function pointInPolygon( pts, x, z ) {

	let inside = false;
	for ( let i = 0, j = pts.length - 1; i < pts.length; j = i ++ ) {

		const [ xi, zi ] = pts[ i ], [ xj, zj ] = pts[ j ];
		if ( ( zi > z ) !== ( zj > z ) && x < ( xj - xi ) * ( z - zi ) / ( zj - zi ) + xi ) inside = ! inside;

	}

	return inside;

}

// signed distance to a polygon's outline (negative inside)
export function polygonDistance( pts, x, z ) {

	const closed = [ ...pts, pts[ 0 ] ];
	const [ d ] = polylineDistance( closed, x, z );
	return pointInPolygon( pts, x, z ) ? - d : d;

}

function bounds( pts, pad ) {

	let x0 = Infinity, x1 = - Infinity, z0 = Infinity, z1 = - Infinity;
	for ( const [ x, z ] of pts ) {

		x0 = Math.min( x0, x ); x1 = Math.max( x1, x ); z0 = Math.min( z0, z ); z1 = Math.max( z1, z );

	}

	return [ x0 - pad, z0 - pad, x1 + pad, z1 + pad ];

}

export class Grading {

	constructor( terrain ) {

		this.T = terrain;
		// the measured ground, before any earthworks (floors and profiles are taken from it)
		this.H0 = terrain.heights.slice();

	}

	natural( x, z ) {

		const { res, origin, texel } = this.T;
		const fx = ( x - origin ) / texel - 0.5, fz = ( z - origin ) / texel - 0.5;
		const i = clamp( Math.floor( fx ), 0, res - 2 ), j = clamp( Math.floor( fz ), 0, res - 2 );
		const tx = fx - i, tz = fz - j, k = j * res + i, H = this.H0;
		return ( H[ k ] * ( 1 - tx ) + H[ k + 1 ] * tx ) * ( 1 - tz ) + ( H[ k + res ] * ( 1 - tx ) + H[ k + res + 1 ] * tx ) * tz;

	}

	each( x0, z0, x1, z1, fn ) {

		const T = this.T;
		const [ i0, i1, j0, j1 ] = texelRange( T, x0, z0, x1, z1 );
		for ( let j = j0; j <= j1; j ++ ) {

			const z = T.origin + ( j + 0.5 ) * T.texel;
			for ( let i = i0; i <= i1; i ++ ) fn( j * T.res + i, T.origin + ( i + 0.5 ) * T.texel, z );

		}

	}

	// worked ground: open (meadow), no bare rock, sand or bank face
	open( k, w = 1 ) {

		const T = this.T;
		T.gully[ k ] = Math.max( T.gully[ k ], Math.round( w * 255 ) );
		T.rock[ k ] *= 1 - w;
		T.sand[ k ] = Math.round( T.sand[ k ] * ( 1 - w ) );
		T.scarp[ k ] = Math.round( T.scarp[ k ] * ( 1 - w ) );

	}

	// smooth an area (a lawn, a plaza): the lidar's bumps go, the slope stays. flat: 0..1 toward a plane
	// through the area's mean (the plaza)
	smoothArea( poly, { blur = 5, flat = 0, edge = 6, open = true } = {} ) {

		const T = this.T, res = T.res;
		const [ x0, z0, x1, z1 ] = bounds( poly, edge + blur + 2 );
		const [ i0, i1, j0, j1 ] = texelRange( T, x0, z0, x1, z1 );
		const w = i1 - i0 + 1, h = j1 - j0 + 1;
		const sub = new Float32Array( w * h );
		for ( let j = 0; j < h; j ++ ) for ( let i = 0; i < w; i ++ ) sub[ j * w + i ] = T.heights[ ( j0 + j ) * res + i0 + i ];
		let sm = boxBlur( sub, w, h, blur );
		sm = boxBlur( sm, w, h, blur );
		// least-squares plane through the area (for the plaza)
		let plane = null;
		if ( flat > 0 ) {

			let n = 0, sx = 0, sz = 0, sh = 0, sxx = 0, szz = 0, sxz = 0, sxh = 0, szh = 0;
			this.each( x0, z0, x1, z1, ( k, x, z ) => {

				if ( ! pointInPolygon( poly, x, z ) ) return;
				const hh = T.heights[ k ];
				n ++; sx += x; sz += z; sh += hh; sxx += x * x; szz += z * z; sxz += x * z; sxh += x * hh; szh += z * hh;

			} );
			const mx = sx / n, mz = sz / n, mh = sh / n;
			const cxx = sxx / n - mx * mx, czz = szz / n - mz * mz, cxz = sxz / n - mx * mz, cxh = sxh / n - mx * mh, czh = szh / n - mz * mh;
			const det = cxx * czz - cxz * cxz;
			const a = ( cxh * czz - czh * cxz ) / det, b = ( czh * cxx - cxh * cxz ) / det;
			plane = ( x, z ) => mh + a * ( x - mx ) + b * ( z - mz );

		}

		this.each( x0, z0, x1, z1, ( k, x, z ) => {

			const d = polygonDistance( poly, x, z );
			const t = 1 - smoothstep( 0, edge, d );
			if ( t <= 0 ) return;
			const i = Math.round( ( x - T.origin ) / T.texel - 0.5 ) - i0, j = Math.round( ( z - T.origin ) / T.texel - 0.5 ) - j0;
			let target = sm[ j * w + i ];
			if ( plane ) target = lerp( target, plane( x, z ), flat );
			T.heights[ k ] = lerp( T.heights[ k ], target, t );
			if ( open ) this.open( k, t );

		} );

	}

	// a path: level across its width, its profile smoothed along it; worn into the ground mask
	path( p ) {

		const T = this.T;
		const pts = p.pts, hw = p.w;
		// profile: the ground along the centreline, smoothed over ~6 m
		const prof = [];
		let len = 0;
		for ( let k = 0; k < pts.length - 1; k ++ ) {

			const [ ax, az ] = pts[ k ], [ bx, bz ] = pts[ k + 1 ];
			const L = Math.hypot( bx - ax, bz - az );
			const n = Math.max( 1, Math.ceil( L / 0.5 ) );
			for ( let s = 0; s < n; s ++ ) {

				const t = s / n;
				const x = ax + ( bx - ax ) * t, z = az + ( bz - az ) * t;
				prof.push( { s: len + L * t, h: this.T.heightAt( x, z ) } );

			}

			len += L;

		}

		prof.push( { s: len, h: T.heightAt( pts[ pts.length - 1 ][ 0 ], pts[ pts.length - 1 ][ 1 ] ) } );
		const R = 12;
		const sm = prof.map( ( q, i ) => {

			let a = 0, wsum = 0;
			for ( let j = Math.max( 0, i - R ); j <= Math.min( prof.length - 1, i + R ); j ++ ) {

				const w = 1 - Math.abs( j - i ) / ( R + 1 );
				a += prof[ j ].h * w; wsum += w;

			}

			return a / wsum;

		} );
		const hAt = ( s ) => {

			const f = clamp( s / len, 0, 1 ) * ( prof.length - 1 );
			const i = Math.min( prof.length - 2, Math.floor( f ) );
			return lerp( sm[ i ], sm[ i + 1 ], f - i );

		};

		p.profile = { length: len, heightAt: hAt };
		const [ x0, z0, x1, z1 ] = bounds( pts, hw * 2 + 3 );
		this.each( x0, z0, x1, z1, ( k, x, z ) => {

			const [ d, s ] = polylineDistance( pts, x, z );
			const t = 1 - smoothstep( hw * 0.8, hw * 2 + 1.5, d );
			if ( t <= 0 ) return;
			T.heights[ k ] = lerp( T.heights[ k ], hAt( s ) - 0.04, t );
			const m = 1 - smoothstep( hw * 0.55, hw * 1.25, d );
			T.path[ k ] = Math.max( T.path[ k ], Math.round( m * 255 ) );
			this.open( k, t );

		} );

	}

	// The stream: a channel dug along the centreline. The bed follows the ground's descent (never climbing:
	// a running minimum), lightly smoothed; the water surface sits ~0.25 m above it. Returns samples every
	// 0.5 m: { x, z, s, w (width), bed, water, slope, fall }.
	stream( pts, pond ) {

		const T = this.T;
		const out = [];
		let s = 0;
		for ( let k = 0; k < pts.length - 1; k ++ ) {

			const a = pts[ k ], b = pts[ k + 1 ];
			const L = Math.hypot( b.x - a.x, b.z - a.z );
			const n = Math.max( 1, Math.ceil( L / 0.5 ) );
			for ( let q = 0; q < n; q ++ ) {

				const t = q / n;
				out.push( { x: lerp( a.x, b.x, t ), z: lerp( a.z, b.z, t ), s: s + L * t, w: lerp( a.w, b.w, t ), seg: k, fall: q === 0 && !! a.fall } );

			}

			s += L;

		}

		const last = pts[ pts.length - 1 ];
		out.push( { x: last.x, z: last.z, s, w: last.w, seg: pts.length - 1, fall: false } );

		// bed: the measured ground less ~0.55 m, never rising downstream; through the pond at its floor
		let run = Infinity;
		for ( const q of out ) {

			let b = this.natural( q.x, q.z ) - 0.55;
			if ( pond && q.seg >= pond.inlet && q.seg < pond.outlet ) b = pond.level - 0.5;
			run = Math.min( run, b );
			q.bed = run;

		}

		// smooth the bed (a few metres), keeping it monotonic, and pin the mouth below the lake
		for ( let pass = 0; pass < 3; pass ++ ) {

			for ( let i = 1; i < out.length - 1; i ++ ) out[ i ].bed2 = ( out[ i - 1 ].bed + out[ i ].bed * 2 + out[ i + 1 ].bed ) / 4;
			for ( let i = 1; i < out.length - 1; i ++ ) out[ i ].bed = Math.min( out[ i ].bed2, out[ i - 1 ].bed );

		}

		out[ out.length - 1 ].bed = Math.min( out[ out.length - 1 ].bed, - 0.6 );
		for ( let i = 0; i < out.length; i ++ ) {

			const q = out[ i ];
			const nb = out[ Math.min( out.length - 1, i + 1 ) ], pb = out[ Math.max( 0, i - 1 ) ];
			q.slope = ( pb.bed - nb.bed ) / Math.max( 0.1, nb.s - pb.s );
			// below the lake surface the stream is the lake
			q.water = Math.max( q.bed + 0.24, Math.min( q.bed + 0.24, 0.0 ) );
			if ( pond && q.seg >= pond.inlet && q.seg < pond.outlet ) q.water = pond.level;

		}

		// dig: a rounded channel, banks easing out over a couple of metres
		const xs = out.map( ( q ) => [ q.x, q.z ] );
		const [ x0, z0, x1, z1 ] = bounds( xs, 8 );
		const sAt = ( ss ) => {

			let lo = 0, hi = out.length - 1;
			while ( hi - lo > 1 ) {

				const m = ( lo + hi ) >> 1;
				if ( out[ m ].s <= ss ) lo = m; else hi = m;

			}

			const a = out[ lo ], b = out[ hi ];
			const t = clamp( ( ss - a.s ) / Math.max( 1e-6, b.s - a.s ), 0, 1 );
			return { bed: lerp( a.bed, b.bed, t ), w: lerp( a.w, b.w, t ) };

		};

		const line = pts.map( ( p ) => [ p.x, p.z ] );
		this.each( x0, z0, x1, z1, ( k, x, z ) => {

			const [ d, ss ] = polylineDistance( line, x, z );
			const { bed, w } = sAt( ss );
			const hw = w * 0.5;
			if ( d > hw + 5 ) return;
			// cross-section: flat bed, banks rising to ~0.9 m at the channel edge, then easing into the ground
			const u = d / hw;
			const cs = bed + ( u < 1 ? 0.25 * u * u : 0.25 + 0.65 * smoothstep( 1, 2.2, u ) );
			const t = 1 - smoothstep( hw + 1.5, hw + 5, d );
			const h = T.heights[ k ];
			if ( cs < h ) T.heights[ k ] = lerp( h, cs, t );
			this.open( k, t * 0.8 );
			T.rock[ k ] = Math.max( T.rock[ k ] * 0.3, ( 1 - smoothstep( hw * 0.8, hw + 1.2, d ) ) * 0.35 );

		} );

		return out;

	}

	// The pond: an elliptical bowl with gently shelving banks. Its level sits just under the lowest point of
	// the natural ground round it (P.level is the upper limit), so the rim never rises as a dyke; uphill the
	// banks are cut back to a gentle slope instead of a wall. Returns the level used.
	pond( P ) {

		const T = this.T;
		const f = frame( P.x, P.z, P.yaw );
		let rimMin = Infinity;
		for ( let k = 0; k < 48; k ++ ) {

			const a = k / 48 * Math.PI * 2;
			const [ x, z ] = f.toW( Math.cos( a ) * P.rx * 1.08, Math.sin( a ) * P.rz * 1.08 );
			rimMin = Math.min( rimMin, this.natural( x, z ) );

		}

		const level = Math.min( P.level, rimMin - 0.12 );
		P.level = level;
		const R = Math.max( P.rx, P.rz ) + 10;
		const Rm = ( P.rx + P.rz ) / 2;
		this.each( P.x - R, P.z - R, P.x + R, P.z + R, ( k, x, z ) => {

			const [ lx, lz ] = f.toL( x, z );
			const r = Math.hypot( lx / P.rx, lz / P.rz );
			const h = T.heights[ k ];
			if ( r < 1 ) {

				// a shelf round the edge, then the bowl
				const d = P.depth * smoothstep( 0.82, 0.35, r ) + 0.25 * smoothstep( 1.0, 0.8, r );
				T.heights[ k ] = Math.min( h, level - d );

			} else {

				// the bank: not below the rim, not steeper than ~1 in 3 up from the water
				const bank = level + 0.12 + ( r - 1 ) * Rm * 0.32;
				const t = 1 - smoothstep( 1.3, 1.8, r );
				T.heights[ k ] = lerp( h, Math.min( Math.max( h, level + 0.12 ), bank ), t );

			}

			this.open( k, 1 - smoothstep( 1.1, 1.6, r ) );

		} );

		return level;

	}

	// A home: the terrace pad in front and the planted mound over the vault(s), into the hillside.
	// Returns { floorY, frontTop( lx ) } (the mound's height at the facade, for the headwall).
	home( h ) {

		const T = this.T;
		const f = frame( h.x, h.z, h.yaw );
		// dug in a little: the terrace in front then needs less fill (lower walls on the downhill side)
		const floorY = h.floor ?? this.natural( h.x, h.z ) - 0.45;
		const arches = [ { o: 0, span: h.span, rise: h.rise }, ...( h.side || [] ).map( ( [ o, span, rise ] ) => ( { o, span, rise } ) ) ];
		let xl = Infinity, xr = - Infinity;
		for ( const a of arches ) {

			xl = Math.min( xl, a.o - a.span / 2 - 1.0 );
			xr = Math.max( xr, a.o + a.span / 2 + 1.0 );

		}

		const depth = h.depth, terrace = h.terrace ?? 5;
		// the mound over one vault: an elliptical barrel ( ring + ~1 m of soil over the crown ), its back
		// rounding off into the slope
		const vault = ( a, lx, lz ) => {

			const A = a.span / 2 + 1.6, B = a.rise + 1.05;
			const u = ( lx - a.o ) / A;
			if ( Math.abs( u ) >= 1.35 ) return - Infinity;
			// shoulders flare out a little beyond the barrel (the soil slumps)
			const prof = Math.abs( u ) < 1 ? Math.sqrt( 1 - u * u ) : 0;
			const shoulder = Math.abs( u ) < 1 ? 0 : - ( Math.abs( u ) - 1 ) * 3.5;
			const back = lz > - a.depth ? 1 : Math.sqrt( Math.max( 0, 1 - ( ( lz + a.depth ) / 5.5 ) ** 2 ) );
			return floorY + ( B * prof + shoulder ) * back - ( 1 - back ) * 1.2;

		};

		for ( const a of arches ) a.depth = a.o === 0 ? depth : depth * 0.7;
		const mound = ( lx, lz ) => {

			// smooth maximum of the vaults
			let m = - Infinity, s = 0;
			for ( const a of arches ) {

				const v = vault( a, lx, lz );
				if ( v === - Infinity ) continue;
				if ( m === - Infinity ) {

					m = v;
					continue;

				}

				const k = 1.2;
				const hh = clamp( 0.5 + 0.5 * ( v - m ) / k, 0, 1 );
				m = lerp( m, v, hh ) + k * hh * ( 1 - hh );
				s ++;

			}

			return m;

		};

		const R = Math.max( xr - xl, depth + terrace ) + 12;
		this.each( h.x - R, h.z - R, h.x + R, h.z + R, ( k, x, z ) => {

			const [ lx, lz ] = f.toL( x, z );
			const hNow = T.heights[ k ];
			// ---- terrace: level pad in front of the facade, retained on the downhill side (a stone wall there)
			if ( lz >= 0 && lz <= terrace && lx >= xl - 0.6 && lx <= xr + 0.6 ) {

				T.heights[ k ] = floorY - 0.03;
				this.open( k );
				T.path[ k ] = Math.max( T.path[ k ], 90 );
				return;

			}

			// around the terrace, uphill ground is cut back on a slope (downhill ground stays: the wall)
			const ex = Math.max( xl - 0.6 - lx, lx - ( xr + 0.6 ), 0 );
			const ez = Math.max( lz - terrace, 0 );
			if ( lz >= 0 ) {

				const e = Math.hypot( ex, ez );
				if ( e < 3.5 && hNow > floorY ) {

					const t = 1 - smoothstep( 0.4, 3.5, e );
					T.heights[ k ] = lerp( hNow, floorY + e * 0.45, t );
					this.open( k, t );

				}

				return;

			}

			// ---- under each arch the ground stays at the floor back past the glazing (the headwall's thick top
			// and the glazing hide the mound's cut behind it)
			if ( lz > - 1.3 ) {

				let open = false;
				for ( const a of arches ) if ( Math.abs( lx - a.o ) < a.span / 2 + 0.75 ) open = true;
				if ( open ) {

					T.heights[ k ] = floorY - 0.03;
					this.open( k );
					return;

				}

			}

			// ---- the mound behind the facade
			const m = mound( lx, lz );
			if ( m === - Infinity ) {

				// beside the mound, ease the slope a little toward the floor level
				return;

			}

			// the vault floor and walls are inside the hill: the mound is the ground wherever it rises above it;
			// a soft maximum so the roof runs into the hillside without a crease
			const kk = 0.9;
			const hh = clamp( 0.5 + 0.5 * ( m - hNow ) / kk, 0, 1 );
			const top = lerp( hNow, m, hh ) + kk * hh * ( 1 - hh );
			// right behind the facade the mound is cut vertical (the headwall); beside the vaults it grades out
			T.heights[ k ] = Math.max( top, floorY - 0.03 );
			const roof = smoothstep( floorY + 0.3, floorY + 1.2, m );
			this.open( k, roof );

		} );

		// the mound's height along the facade line, for the headwall (the mound itself, before the cut under
		// the arches)
		const top = ( lx ) => {

			const [ x, z ] = f.toW( lx, - 1.4 );
			return Math.max( mound( lx, - 0.5 ), Math.min( T.heightAt( x, z ), floorY + 8 ) );

		};

		return { floorY, xl, xr, terrace, frontTop: top, arches, frame: f };

	}

	// a level pad (the towers' footings, the dock's landing): radius r, blended over `edge`
	pad( x, z, r, y, edge = 4 ) {

		const T = this.T;
		this.each( x - r - edge, z - r - edge, x + r + edge, z + r + edge, ( k, xx, zz ) => {

			const d = Math.hypot( xx - x, zz - z );
			const t = 1 - smoothstep( r, r + edge, d );
			if ( t <= 0 ) return;
			T.heights[ k ] = lerp( T.heights[ k ], y, t );
			this.open( k, t );

		} );

	}

}
