import { mulberry32, smoothstep, clamp } from '../../util/Noise.js';
import { PINE_H, HEMLOCK_H } from './ConiferGeometry.js';

// Plant placement for the New Hampshire woods and the village (replaces the island's scatter).
//
// Land cover from the terrain masks: forest floor everywhere on land except the open ground (the meadow
// mask: the village clearing, the worked ground, the roofs), bare rock, beach sand and paths. Species by
// site, as on Squam's north shore:
//   white pine   the shores (big pines leaning over the water), dry knolls and ledges, emergent over the
//                hardwoods anywhere
//   hemlock      cool, damp ground: ravines and hollows, north-facing slopes, along the water and streams
//   hardwoods    the slopes between (maples, red oak, beech); paper birch at the edges and on the rocky
//                ground, and planted round the village (canopy trees, species by seed: see seedFor)
//   shrubs       mountain laurel and lowbush blueberry in the forest gaps, hobblebush in the damp; and
//                round the homes
//   ferns        the forest floor (hay-scented and cinnamon ferns in drifts), the village's banks
// In the village clearing: clumps of open-grown oaks and maples with broad, low crowns, birches, a few
// pines; the mown green kept open; shrubs and ferns along the homes.
//
// Records: { x, y, z, s, sy, yaw, la, l, H, seed } as the instanced vegetation expects (VegInstances):
// canopy trees l = sy, shrubs l = -sy; pines l = sy, hemlocks l = -sy (the impostors' group flag).

// broadleaf species of the canopy material (VegMaterials vegTreeSpecies: floor( fract( seed * 5.31 ) * 4 ))
export const TREE_SPECIES = { MAPLE: 0, OAK: 1, BIRCH: 2, BEECH: 3 };
// shrubs (vegShrubSpecies: < 0.45 laurel, < 0.6 hobblebush, else blueberry)
export const SHRUB_SPECIES = { LAUREL: 0, HOBBLEBUSH: 1, BLUEBERRY: 2 };

// a seed in [0, 1) whose canopy species is sp (and random otherwise)
export function seedFor( sp, r ) {

	const u = ( sp + 0.06 + 0.88 * ( ( r * 7.31 ) % 1 ) ) / 4;
	const n = Math.floor( r * 4.999 );
	return ( n + u ) / 5.31;

}

function shrubSeed( sp, r ) {

	// vegShrubSpecies( seed ): h = fract( seed * 3.17 )
	const lo = [ 0, 0.45, 0.6 ][ sp ], hi = [ 0.45, 0.6, 1 ][ sp ];
	const u = lo + 0.02 + ( hi - lo - 0.04 ) * ( ( r * 5.13 ) % 1 );
	const n = Math.floor( r * 2.999 );
	return ( n + u ) / 3.17;

}

class Occupancy {

	constructor( cell = 4 ) {

		this.cell = cell;
		this.map = new Map();

	}

	_key( i, j ) {

		return ( i + 32768 ) * 65536 + ( j + 32768 );

	}

	add( x, z, r ) {

		const k = this._key( Math.floor( x / this.cell ), Math.floor( z / this.cell ) );
		let a = this.map.get( k );
		if ( ! a ) this.map.set( k, a = [] );
		a.push( x, z, r );

	}

	free( x, z, r, spacing = 1 ) {

		const reach = r + 8, c = this.cell;
		const i0 = Math.floor( ( x - reach ) / c ), i1 = Math.floor( ( x + reach ) / c );
		const j0 = Math.floor( ( z - reach ) / c ), j1 = Math.floor( ( z + reach ) / c );
		for ( let j = j0; j <= j1; j ++ ) for ( let i = i0; i <= i1; i ++ ) {

			const a = this.map.get( this._key( i, j ) );
			if ( ! a ) continue;
			for ( let k = 0; k < a.length; k += 3 ) {

				const dx = a[ k ] - x, dz = a[ k + 1 ] - z, d = ( a[ k + 2 ] + r ) * spacing;
				if ( dx * dx + dz * dz < d * d ) return false;

			}

		}

		return true;

	}

}

// inside one of the village's designed vistas (corridors kept free of trees)?
function inVista( vistas, x, z ) {

	for ( const v of vistas || [] ) {

		const [ ax, az ] = v.from, ex = v.to[ 0 ] - ax, ez = v.to[ 1 ] - az;
		const t = clamp( ( ( x - ax ) * ex + ( z - az ) * ez ) / ( ex * ex + ez * ez ), 0, 1 );
		if ( Math.hypot( x - ax - ex * t, z - az - ez * t ) < v.w ) return true;

	}

	return false;

}

function scatter( rand, x0, z0, x1, z1, step, fn ) {

	for ( let z = z0; z < z1; z += step ) for ( let x = x0; x < x1; x += step ) fn( x + rand() * step, z + rand() * step );

}

// site description at (x, z) from the terrain (TerrainData) and the obstacles (VegSite)
function cover( site, x, z, out ) {

	const T = site.terrain;
	out.h = T.heightAt( x, z );
	out.ny = site.normalY( x, z );
	out.slope = 1 - out.ny;
	out.rock = site.rock( x, z );
	out.open = site._mask( T.gully, x, z, 1 / 255 );
	out.sand = site._mask( T.sand, x, z, 1 / 255 );
	out.path = site._mask( T.path, x, z, 1 / 255 );
	out.scarp = site._mask( T.scarp, x, z, 1 / 255 );
	out.shore = - T.coastDistance( x, z ).d; // metres from the water (< 0 in it)
	// aspect: how much the slope faces north (hemlock) or south (oak, pine)
	const n = site.n;
	T.normalAt( x, z, n );
	out.north = - n.z / Math.max( 1e-3, Math.hypot( n.x, n.z ) ) * smoothstep( 0.05, 0.25, out.slope );
	// hollows (concave ground: ravines, stream lines) from the height at a ring of 12 m
	const r = 12;
	out.hollow = ( T.heightAt( x + r, z ) + T.heightAt( x - r, z ) + T.heightAt( x, z + r ) + T.heightAt( x, z - r ) ) / 4 - out.h;
	return out;

}

export function scatterForest( site, seed = 2026 ) {

	const rand = mulberry32( seed );
	const T = site.terrain;
	const N = site.noise, N2 = site.noise2;
	const occT = new Occupancy( 6 ); // crowns
	const occ = new Occupancy( 3 ); // stems and small plants
	const out = { pines: [], hemlocks: [], trees: [], shrubs: [], ferns: [] };
	const c = {};
	const TAU = Math.PI * 2;
	const half = T.size / 2 - 4;
	const ok = ( x, z, clear, { maxOpen = 1, maxSlope = 0.62 } = {} ) => {

		if ( c.h < 0.35 || c.rock > 0.5 || c.sand > 0.4 || c.path > 0.25 || c.scarp > 0.4 || c.slope > maxSlope ) return false;
		if ( c.open > maxOpen ) return false;
		if ( site.obstacleDist( x, z ) < 2 + clear ) return false;
		if ( T.pathDistance( x, z ) < 0.8 + clear * 0.5 ) return false;
		return true;

	};

	// ---- canopy: one pass, species by site --------------------------------------------------------
	scatter( rand, - half, - half, half, half, 4.4, ( x, z ) => {

		cover( site, x, z, c );
		if ( c.h < 0.35 ) return;
		const stand = N.fbm( x / 140, z / 140, 3 ); // stands of one character
		const patch = N2.fbm( x / 37, z / 37, 2 );
		// in the open (the village clearing, the roofs) trees in clumps and groves with glades between
		// (docs/REFERENCE.md: the village stands among trees); the mown green stays open but for its edges
		const forest = 1 - smoothstep( 0.25, 0.75, c.open );
		const lawn = site.inLawn ? site.inLawn( x, z ) : 0;
		// (reference/neighborhood-v2.png: the rows of homes are open, flowery shelves with a tree here and there;
		// more between the rows' ends and above them)
		const od = site.obstacleDist( x, z );
		const amongHomes = smoothstep( 14, 5, od );
		let p = 0.92 * forest + ( 1 - forest ) * 0.3 * smoothstep( - 0.4, 0.3, patch ) * ( 1 - lawn * 0.95 ) * ( 1 - amongHomes * 0.5 );
		// thinner on the ledges and steep ground
		p *= 1 - smoothstep( 0.3, 0.6, c.rock ) * 0.6 - smoothstep( 0.45, 0.62, c.slope ) * 0.5;
		if ( rand() > p ) return;
		if ( ! ok( x, z, forest > 0.5 ? 1.5 : 2.5 ) || inVista( site.vistas, x, z ) ) return;

		// site affinities
		const shoreK = 1 - smoothstep( 6, 45, c.shore );
		const damp = clamp( smoothstep( 0.4, 2.5, c.hollow ) + Math.max( 0, c.north ) * 0.7 + shoreK * 0.45, 0, 1.5 );
		const dry = clamp( smoothstep( - 0.4, - 2.5, c.hollow ) + Math.max( 0, - c.north ) * 0.5 + smoothstep( 0.2, 0.5, c.rock ) * 0.8, 0, 1.5 );
		let wPine = 0.22 + shoreK * 0.9 + dry * 0.35 + ( stand > 0.15 ? 0.3 : 0 );
		let wHem = 0.12 + damp * 0.8 + ( stand < - 0.2 ? 0.45 : 0 );
		let wHard = 0.65 * ( 1 - shoreK * 0.5 ) * ( 1 - damp * 0.3 );
		if ( forest < 0.5 ) {

			// the clearing: hardwoods above all, a few pines
			wPine *= 0.3; wHem *= 0.05; wHard *= 1.6;

		}

		const tot = wPine + wHem + wHard;
		const u = rand() * tot;
		const yaw = rand() * TAU;
		if ( u < wPine ) {

			const s = ( 0.75 + rand() * 0.45 ) * ( rand() < 0.12 ? 1.2 : 1 ) * ( shoreK > 0.5 ? 1.1 : 1 );
			const sy = 0.85 + rand() * 0.3;
			const r = 3.6 * s;
			if ( ! occT.free( x, z, r * 0.8, 1 ) ) return;
			occT.add( x, z, r * 0.8 );
			occ.add( x, z, 0.5 * s );
			// in the forest (not the clearing, not right on the shore) the pine has shed its lower limbs
			const grownIn = forest > 0.5 && shoreK < 0.6;
			out.pines.push( { x, y: site.groundY( x, z, 0.5 ) - 0.2, z, s, sy, yaw, la: yaw, l: sy, H: PINE_H * s * sy, seed: rand() + ( grownIn ? 2 : 0 ) } );

		} else if ( u < wPine + wHem ) {

			const s = 0.7 + rand() * 0.45;
			const sy = 0.85 + rand() * 0.3;
			const r = 3.2 * s;
			if ( ! occT.free( x, z, r * 0.85, 1 ) ) return;
			occT.add( x, z, r * 0.85 );
			occ.add( x, z, 0.5 * s );
			out.hemlocks.push( { x, y: site.groundY( x, z, 0.4 ) - 0.15, z, s, sy, yaw, la: yaw, l: - sy, H: HEMLOCK_H * s * sy, seed: rand() } );

		} else {

			// hardwoods: birch at the edges, on rocky ground and in the clearing; red oak on the dry slopes;
			// maple and beech elsewhere
			const edge = smoothstep( 0.1, 0.5, c.open ) * ( 1 - smoothstep( 0.6, 0.95, c.open ) );
			const open = forest < 0.5;
			const wB = 0.12 + edge * 1.2 + ( open ? 0.35 : 0 ) + smoothstep( 0.2, 0.45, c.rock ) * 0.4;
			const wO = 0.25 + dry * 0.5 + ( open ? 0.45 : 0 );
			const wM = 0.45 + damp * 0.2;
			const wE = open ? 0.1 : 0.25;
			const v = rand() * ( wB + wO + wM + wE );
			const sp = v < wB ? 2 : v < wB + wO ? 1 : v < wB + wO + wM ? 0 : 3;
			const birch = sp === 2;
			// open-grown hardwoods spread wide and low
			const s = ( birch ? 0.95 + rand() * 0.3 : 1.15 + rand() * 0.45 ) * ( open && ! birch ? 1.15 : 1 );
			const sy = ( birch ? 1.15 : open ? 0.82 : 0.95 ) + rand() * ( open && ! birch ? 0.2 : 0.3 );
			const r = 2.5 * s;
			if ( ! occT.free( x, z, r, 1 ) ) return;
			occT.add( x, z, r );
			occ.add( x, z, 0.5 * s );
			out.trees.push( { x, y: site.groundY( x, z, 0.6 ) - 0.15, z, s, sy, yaw, la: yaw, l: sy, H: 12.5 * s * sy, seed: seedFor( sp, rand() ) } );
			// birches grow in clumps of two or three stems
			if ( birch && rand() < 0.55 ) {

				for ( let k = 0; k < 1 + Math.floor( rand() * 2 ); k ++ ) {

					const a = rand() * TAU, d = 1.6 + rand() * 1.4;
					const bx = x + Math.cos( a ) * d, bz = z + Math.sin( a ) * d;
					cover( site, bx, bz, c );
					if ( ! ok( bx, bz, 2 ) || inVista( site.vistas, bx, bz ) ) continue;
					const s2 = s * ( 0.75 + rand() * 0.2 );
					out.trees.push( { x: bx, y: site.groundY( bx, bz, 0.4 ) - 0.15, z: bz, s: s2, sy: sy * ( 0.95 + rand() * 0.1 ), yaw: rand() * TAU, la: rand() * TAU, l: sy, H: 12.5 * s2 * sy, seed: seedFor( 2, rand() ) } );
					occ.add( bx, bz, 0.4 );

				}

			}

		}

	} );

	// ---- the village's own plantings (pots on the terraces) --------------------------------------------
	for ( const pl of site.plantings || [] ) {

		const yaw = rand() * TAU;
		if ( pl.kind === 'tree' ) {

			// a fruit tree: short trunk, broad low crown (a beech-green canopy tree, squat); or the species asked
			// for (pl.sp: the green's oaks)
			const sy = pl.sy ?? 0.7 + rand() * 0.1;
			out.trees.push( { x: pl.x, y: pl.y, z: pl.z, s: pl.s, sy, yaw, la: yaw, l: sy, H: 12.5 * pl.s * sy, seed: seedFor( pl.sp ?? 3, rand() ) } );
			occT.add( pl.x, pl.z, 2.5 * pl.s );

		} else if ( pl.kind === 'shrub' ) {

			const sp = rand() < 0.5 ? 1 : 0;
			const sy = 0.45 + rand() * 0.25;
			const s = pl.s * ( pl.crop ? 1.0 : 0.7 );
			const syy = pl.crop ? 0.6 : sy;
			out.shrubs.push( { x: pl.x, y: pl.y, z: pl.z, s, sy: syy, yaw, la: yaw, l: - syy, H: 1.6 * s * syy, seed: shrubSeed( pl.crop ? 2 : sp, rand() ) } );

		} else {

			out.ferns.push( { x: pl.x, y: pl.y, z: pl.z, s: pl.s * 0.9, yaw, la: 0, l: 0, H: 0.05, seed: rand() } );

		}

		occ.add( pl.x, pl.z, 0.5 );

	}

	// ---- shrubs: forest gaps and edges; round the homes and along the paths in the village -----------
	scatter( rand, - half, - half, half, half, 3.4, ( x, z ) => {

		cover( site, x, z, c );
		if ( c.h < 0.4 ) return;
		const clump = N2.fbm( x / 24 + 3.3, z / 24 - 7.1, 2 );
		const od = site.obstacleDist( x, z );
		const village = smoothstep( 0.4, 0.8, c.open ) * ( 0.06 + 0.5 * smoothstep( 9, 2.5, od ) );
		// (none on the mown green: the festival ground's tables and poles are not walls to plant against)
		const lawnS = site.inLawn ? site.inLawn( x, z ) : 0;
		const p = ( 0.16 * ( 1 - smoothstep( 0.4, 0.8, c.open ) ) + village ) * smoothstep( - 0.25, 0.25, clump ) * ( 1 - lawnS );
		if ( rand() > p ) return;
		if ( ! ok( x, z, 0.4, { maxSlope: 0.55 } ) ) return;
		const s = 0.75 + rand() * 0.5;
		if ( ! occ.free( x, z, 0.9 * s, 1 ) ) return;
		occ.add( x, z, 0.9 * s );
		const damp = smoothstep( 0.5, 2.5, c.hollow ) + Math.max( 0, c.north ) * 0.5;
		const sp = c.rock > 0.2 || rand() < 0.35 ? 2 : damp > 0.5 && rand() < 0.6 ? 1 : 0;
		const sy = ( sp === 2 ? 0.45 : 0.75 ) + rand() * 0.35;
		const yaw = rand() * TAU;
		out.shrubs.push( { x, y: site.groundY( x, z, 0.3 ) - 0.08 * s, z, s, sy, yaw, la: yaw, l: - sy, H: 1.6 * s * sy, seed: shrubSeed( sp, rand() ) } );

	} );

	// ---- ferns: drifts on the forest floor, the village's banks and the foot of its walls ----------
	scatter( rand, - half, - half, half, half, 1.9, ( x, z ) => {

		cover( site, x, z, c );
		if ( c.h < 0.4 ) return;
		const drift = N2.fbm( x / 26 - 9.9, z / 26 + 3.7, 3 );
		const od = site.obstacleDist( x, z );
		const forestFloor = ( 1 - smoothstep( 0.3, 0.7, c.open ) ) * ( 0.25 + 0.5 * smoothstep( 0.3, 2.0, c.hollow ) + 0.25 * Math.max( 0, c.north ) );
		const village = smoothstep( 0.4, 0.8, c.open ) * 0.55 * smoothstep( 6, 1.5, od );
		const p = ( forestFloor + village ) * smoothstep( - 0.3, 0.2, drift ) * ( 1 - ( site.inLawn ? site.inLawn( x, z ) : 0 ) );
		if ( rand() > p ) return;
		if ( ! ok( x, z, 0.2, { maxSlope: 0.6 } ) ) return;
		const s = 0.75 + rand() * 0.6;
		if ( ! occ.free( x, z, 0.45 * s, 1 ) ) return;
		occ.add( x, z, 0.45 * s );
		out.ferns.push( { x, y: c.h - 0.03, z, s, yaw: rand() * TAU, la: 0, l: 0, H: 0.05, seed: rand() } );

	} );

	return out;

}

// ground flora mask, RGBA8 at 2 m over the near terrain (GrassField):
//   R short sward (the green, trodden ground near the homes), G meadow grass (the roofs, the clearing,
//   glades), B lupines (drifts in the meadows), A low flowering creepers (daisies, clover in the lawn)
export const GRASS_MASK_TEXEL = 2;
export function buildMeadowMask( site ) {

	const T = site.terrain;
	const res = Math.round( T.size / GRASS_MASK_TEXEL );
	const texel = T.size / res;
	const data = new Uint8Array( res * res * 4 );
	const N = site.noise, N2 = site.noise2;
	for ( let j = 1; j < res - 1; j ++ ) {

		const z = T.origin + ( j + 0.5 ) * texel;
		for ( let i = 1; i < res - 1; i ++ ) {

			const x = T.origin + ( i + 0.5 ) * texel;
			const h = T.heightAt( x, z );
			if ( h < 0.3 ) continue;
			const open = site._mask( T.gully, x, z, 1 / 255 );
			if ( open < 0.15 ) continue;
			const rock = site.rock( x, z ), path = site._mask( T.path, x, z, 1 / 255 ), sand = site._mask( T.sand, x, z, 1 / 255 );
			if ( rock > 0.45 || sand > 0.5 ) continue;
			const od = site.obstacleDist( x, z );
			const keep = smoothstep( 0.5, 2.5, od ) * ( 1 - smoothstep( 0.15, 0.45, path ) ) * ( 1 - smoothstep( 0.25, 0.45, rock ) ) * smoothstep( 0.15, 0.5, open );
			const lawn = site.inLawn ? site.inLawn( x, z ) : 0;
			const clump = N.noise( x / 7.5, z / 7.5 ) * 0.65 + N2.noise( x / 19, z / 19 ) * 0.35;
			const meadow = ( 1 - lawn ) * ( 0.75 + 0.25 * smoothstep( - 0.4, 0.3, clump ) );
			const nearHome = smoothstep( 7, 2.5, od );
			const lupine = ( 1 - lawn ) * Math.max( smoothstep( 0.0, 0.35, N.noise( x / 13 + 5.1, z / 13 - 2.7 ) + N2.noise( x / 4, z / 4 ) * 0.2 ) * 0.9, nearHome * 0.8 );
			const creep = lawn * smoothstep( 0.05, 0.35, N2.noise( x / 6 - 1.1, z / 6 + 4.4 ) ) + ( 1 - lawn ) * 0.55 * smoothstep( - 0.3, 0.3, N2.noise( x / 9 + 2.2, z / 9 ) );
			const o = ( j * res + i ) * 4;
			data[ o ] = Math.round( 255 * clamp( lawn * keep * ( 0.55 + 0.25 * clump ), 0, 1 ) );
			data[ o + 1 ] = Math.round( 255 * clamp( meadow * keep, 0, 1 ) );
			data[ o + 2 ] = Math.round( 255 * clamp( lupine * keep, 0, 1 ) );
			data[ o + 3 ] = Math.round( 255 * clamp( creep * keep, 0, 1 ) );

		}

	}

	return { data, res };

}
