import * as THREE from '../../engine/index.js';
import { mulberry32 } from '../../util/Noise.js';
import { GeoBuilder } from './GeoBuilder.js';

// The two conifers of the New Hampshire woods, as near geometry for the instanced vegetation:
//
//   eastern white pine (Pinus strobus): the tallest tree here (~25 m), a straight trunk bare of
//     branches for its lower third in the forest, whorls of near-horizontal limbs, the foliage in soft,
//     flat, layered plates of long needles at the limb ends (the "brushy" tiers of the skyline)
//   eastern hemlock (Tsuga canadensis): ~18 m, a dense dark cone branching almost to the ground, the
//     branches drooping, the foliage in flat feathery sprays; the leader nods over at the top
//
// Vertex layout (vegetation GeoBuilder): aVeg = (height fraction, branch flex, flutter, phase);
// aMat = (part, exposure, colour random, card random) with parts 0 pine bark, 1 pine needles, 2 hemlock
// bark, 3 hemlock needles; aLobe = (offset to the whorl's point on the trunk, whorl id) for the limbs and
// the needle cards of a whorl (-1 on the trunk). A per-instance variant drops some whorls (the cards and
// limbs collapse onto the trunk), so the crowns differ: see CONIFER_DROP.

export const PINE_H = 24;
export const HEMLOCK_H = 18;
export const CONIFER_VARIANTS = 3;
export const MAX_WHORLS = 24;

// per variant, the whorls that stay (1) or drop (0); whorl 0 is the lowest. Shared by the shader and
// the impostor variants (lobe w = whorl id)
export const CONIFER_DROP = ( () => {

	const rand = mulberry32( 7071 );
	const t = [];
	for ( let v = 0; v < CONIFER_VARIANTS; v ++ ) for ( let w = 0; w < MAX_WHORLS; w ++ ) t.push( v === 0 ? 1 : ( rand() < 0.2 ? 0 : 1 ) );
	return t;

} )();

const _a = new THREE.Vector3();

// a tapered tube from p0 to p1 (radii r0 -> r1); lobe: aLobe for every vertex (whorl tagging)
function tube( b, p0, p1, r0, r1, radial, rows, part, H, flexFn, lobeFor = null, uScale = 1 ) {

	const axis = _a.copy( p1 ).sub( p0 );
	const L = axis.length();
	axis.divideScalar( L );
	const ref = Math.abs( axis.y ) > 0.9 ? new THREE.Vector3( 1, 0, 0 ) : new THREE.Vector3( 0, 1, 0 );
	const side = new THREE.Vector3().crossVectors( axis, ref ).normalize();
	const up = new THREE.Vector3().crossVectors( side, axis ).normalize();
	const base = b.count;
	for ( let j = 0; j <= rows; j ++ ) {

		const t = j / rows;
		const c = p0.clone().lerp( p1, t );
		const r = r0 + ( r1 - r0 ) * t;
		for ( let i = 0; i <= radial; i ++ ) {

			const a = i / radial * Math.PI * 2;
			const n = side.clone().multiplyScalar( Math.cos( a ) ).addScaledVector( up, Math.sin( a ) );
			const p = c.clone().addScaledVector( n, r );
			b.vertex( p, n, i / radial * uScale, t * L / ( 2 * Math.PI * Math.max( r0, 0.02 ) ) * uScale, [ p.y / H, flexFn( p ), 0, 0 ], [ part, 0.5, 0, 0 ], lobeFor ? lobeFor( p ) : null );

		}

	}

	for ( let j = 0; j < rows; j ++ ) for ( let i = 0; i < radial; i ++ ) {

		const a = base + j * ( radial + 1 ) + i, c = a + radial + 1;
		b.quad( a, a + 1, c + 1, c );

	}

}

// a needle card: a quad centred at c with its in-plane axes u (length su) and v (length sv); normal n.
// exposure: 0 inner .. 1 outer / upper; lobe: whorl tagging
function card( b, c, u, v, su, sv, part, exposure, cr, H, flexFn, phase, lobe ) {

	const n = new THREE.Vector3().crossVectors( u, v ).normalize();
	// the card normal leans outward from the crown axis (rounded crown lighting)
	const out = new THREE.Vector3( c.x, 0, c.z );
	if ( out.lengthSq() > 1e-6 ) out.normalize();
	const N = n.clone().multiplyScalar( 0.35 ).addScaledVector( out, 0.65 ).add( new THREE.Vector3( 0, 0.35, 0 ) ).normalize();
	const base = b.count;
	const corners = [ [ - 0.5, - 0.5 ], [ 0.5, - 0.5 ], [ 0.5, 0.5 ], [ - 0.5, 0.5 ] ];
	for ( const [ x, y ] of corners ) {

		const p = c.clone().addScaledVector( u, x * su ).addScaledVector( v, y * sv );
		b.vertex( p, N, x + 0.5, y + 0.5, [ p.y / H, flexFn( p ), 0.6, phase ], [ part, exposure, cr, phase ], lobe( p ) );

	}

	b.quad( base, base + 1, base + 2, base + 3 );

}

function pineFlex( p ) {

	return Math.min( 1, Math.hypot( p.x, p.z ) / 4.5 ) * smooth( 6, 14, p.y );

}

function smooth( a, b, x ) {

	const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

}

// Eastern white pine. Returns { geometry, triangles }.
export function buildPineNear( seed = 61 ) {

	const b = new GeoBuilder();
	const rand = mulberry32( seed );
	const H = PINE_H;
	// trunk: a slight sweep, tapering to the leader
	const lean = new THREE.Vector3( ( rand() - 0.5 ) * 0.5, 0, ( rand() - 0.5 ) * 0.5 );
	const axisAt = ( y ) => new THREE.Vector3( lean.x * ( y / H ) ** 2, y, lean.z * ( y / H ) ** 2 );
	const trunkSegs = 8;
	for ( let s = 0; s < trunkSegs; s ++ ) {

		const y0 = - 0.6 + ( H + 0.6 ) * s / trunkSegs, y1 = - 0.6 + ( H + 0.6 ) * ( s + 1 ) / trunkSegs;
		const r = ( y ) => Math.max( 0.03, 0.36 * Math.pow( 1 - Math.max( 0, y ) / H, 0.85 ) ) * ( 1 + 0.25 * Math.exp( - Math.max( y + 0.4, 0 ) / 0.6 ) );
		tube( b, axisAt( y0 ), axisAt( y1 ), r( y0 ), r( y1 ), 9, 1, 0, H, pineFlex );

	}

	// whorls of limbs from ~40 % of the height; a few dead stubs below
	const crownBase = H * 0.38;
	let y = crownBase;
	let whorl = 0;
	let az = rand() * Math.PI * 2;
	while ( y < H - 1.2 && whorl < MAX_WHORLS ) {

		const t = ( y - crownBase ) / ( H - crownBase );
		const w = whorl;
		const T = axisAt( y );
		const lobe = ( p ) => [ T.x - p.x, T.y - p.y, T.z - p.z, w ];
		const limbs = 3 + Math.floor( rand() * 3 );
		for ( let k = 0; k < limbs; k ++ ) {

			az += 2.39996 + ( rand() - 0.5 ) * 0.6;
			// long limbs low in the crown, the widest tier about a third of the way up, short at the top
			const L = ( 1.6 + 4.4 * Math.pow( 1 - t, 0.75 ) * ( 0.55 + 0.45 * Math.sin( Math.min( 1, t * 2.2 + 0.25 ) * Math.PI ) ) ) * ( 0.7 + rand() * 0.5 );
			const dir = new THREE.Vector3( Math.cos( az ), 0, Math.sin( az ) );
			const rise = 0.05 + t * 0.35 + ( rand() - 0.5 ) * 0.12; // upswept toward the top
			const end = T.clone().addScaledVector( dir, L ).add( new THREE.Vector3( 0, L * rise, 0 ) );
			const mid = T.clone().lerp( end, 0.5 ).add( new THREE.Vector3( 0, - L * 0.06, 0 ) );
			tube( b, T, mid, 0.09 * ( 1 - t * 0.5 ), 0.055, 4, 1, 0, H, pineFlex, lobe );
			tube( b, mid, end, 0.055, 0.02, 4, 1, 0, H, pineFlex, lobe );
			// foliage plates along the outer part of the limb: flat, layered, a little tilted; a smaller
			// vertical card through each so the tufts hold from the side
			const plates = 3 + Math.floor( L / 1.2 );
			for ( let q = 0; q < plates; q ++ ) {

				const f = 0.3 + 0.7 * ( q + rand() * 0.6 ) / plates;
				const c = T.clone().lerp( end, f ).add( new THREE.Vector3( ( rand() - 0.5 ) * 0.5, 0.15 + rand() * 0.3, ( rand() - 0.5 ) * 0.5 ) );
				const size = ( 2.0 + rand() * 1.3 ) * ( 0.7 + 0.3 * ( 1 - t ) );
				const tilt = ( rand() - 0.5 ) * 0.5;
				const u = dir.clone().applyAxisAngle( new THREE.Vector3( 0, 1, 0 ), ( rand() - 0.5 ) * 0.9 );
				const v = new THREE.Vector3( 0, 0, 0 ).crossVectors( new THREE.Vector3( 0, 1, 0 ), u ).normalize().multiplyScalar( - 1 );
				v.applyAxisAngle( u, tilt ).add( new THREE.Vector3( 0, 0.18, 0 ) ).normalize();
				const exposure = Math.min( 1, 0.35 + f * 0.4 + t * 0.35 );
				card( b, c, u, v, size * 1.25, size, 1, exposure, rand(), H, pineFlex, rand(), lobe );
				const vv = new THREE.Vector3( 0, 1, 0 );
				card( b, c.clone().add( new THREE.Vector3( 0, 0.12, 0 ) ), u, vv, size * 1.05, size * 0.55, 1, exposure, rand(), H, pineFlex, rand(), lobe );

			}

		}

		y += 1.25 + rand() * 0.75;
		whorl ++;

	}

	// the leader's last tufts
	const top = axisAt( H );
	const topLobe = ( p ) => [ top.x - p.x, top.y - p.y, top.z - p.z, MAX_WHORLS - 1 ];
	for ( let k = 0; k < 3; k ++ ) {

		const a = k * 2.1 + rand();
		const u = new THREE.Vector3( Math.cos( a ), 0, Math.sin( a ) );
		card( b, top.clone().add( new THREE.Vector3( 0, - 0.5, 0 ) ), u, new THREE.Vector3( 0, 1, 0 ), 1.0, 1.5, 1, 1, rand(), H, pineFlex, rand(), topLobe );

	}

	return { geometry: b.build( 14, new THREE.Vector3( 0, H * 0.6, 0 ) ), triangles: b.idx.length / 3 };

}

function hemFlex( p ) {

	return Math.min( 1, Math.hypot( p.x, p.z ) / 3.5 ) * smooth( 1, 10, p.y );

}

// Eastern hemlock. Returns { geometry, triangles }.
export function buildHemlockNear( seed = 67 ) {

	const b = new GeoBuilder();
	const rand = mulberry32( seed );
	const H = HEMLOCK_H;
	const axisAt = ( y ) => {

		// the leader nods over at the top
		const k = smooth( H - 2.5, H, y );
		return new THREE.Vector3( k * k * 0.6, y - k * 0.15, 0 );

	};

	const trunkSegs = 7;
	for ( let s = 0; s < trunkSegs; s ++ ) {

		const y0 = - 0.5 + ( H + 0.5 ) * s / trunkSegs, y1 = - 0.5 + ( H + 0.5 ) * ( s + 1 ) / trunkSegs;
		const r = ( y ) => Math.max( 0.025, 0.3 * Math.pow( 1 - Math.max( 0, y ) / H, 0.9 ) ) * ( 1 + 0.3 * Math.exp( - Math.max( y + 0.3, 0 ) / 0.5 ) );
		tube( b, axisAt( y0 ), axisAt( y1 ), r( y0 ), r( y1 ), 8, 1, 2, H, hemFlex );

	}

	const crownBase = H * 0.1;
	let y = crownBase;
	let whorl = 0;
	let az = rand() * Math.PI * 2;
	while ( y < H - 0.6 && whorl < MAX_WHORLS ) {

		const t = ( y - crownBase ) / ( H - crownBase );
		const w = whorl;
		const T = axisAt( y );
		const lobe = ( p ) => [ T.x - p.x, T.y - p.y, T.z - p.z, w ];
		const limbs = 4 + Math.floor( rand() * 2 );
		for ( let k = 0; k < limbs; k ++ ) {

			az += 2.39996 + ( rand() - 0.5 ) * 0.5;
			// a cone: long below, short above
			const L = ( 0.5 + 4.0 * Math.pow( 1 - t, 0.95 ) ) * ( 0.8 + rand() * 0.35 );
			const dir = new THREE.Vector3( Math.cos( az ), 0, Math.sin( az ) );
			const droop = - 0.12 - ( 1 - t ) * 0.15;
			const end = T.clone().addScaledVector( dir, L ).add( new THREE.Vector3( 0, L * droop, 0 ) );
			tube( b, T, end, 0.06 * ( 1 - t * 0.6 ), 0.015, 3, 1, 2, H, hemFlex, lobe );
			// flat drooping sprays along the limb, overlapping like shingles
			const sprays = 1 + Math.floor( L / 0.9 );
			for ( let q = 0; q < sprays; q ++ ) {

				const f = 0.25 + 0.75 * ( q + 0.5 ) / sprays;
				const c = T.clone().lerp( end, f ).add( new THREE.Vector3( 0, 0.05, 0 ) );
				const size = ( 1.0 + rand() * 0.6 ) * ( 0.65 + 0.35 * ( 1 - t ) );
				const u = dir.clone().applyAxisAngle( new THREE.Vector3( 0, 1, 0 ), ( rand() - 0.5 ) * 0.8 );
				const v = new THREE.Vector3().crossVectors( new THREE.Vector3( 0, 1, 0 ), u ).normalize().multiplyScalar( - 1 );
				// drooping at the outer end: tilt the card down along the limb
				const uu = u.clone().add( new THREE.Vector3( 0, - 0.35 - rand() * 0.25, 0 ) ).normalize();
				v.add( new THREE.Vector3( 0, ( rand() - 0.5 ) * 0.3, 0 ) ).normalize();
				const exposure = Math.min( 1, 0.25 + f * 0.45 + t * 0.3 );
				card( b, c, uu, v, size * 1.3, size, 3, exposure, rand(), H, hemFlex, rand(), lobe );
				if ( q === sprays - 1 ) card( b, c, uu, new THREE.Vector3( 0, 1, 0 ), size, size * 0.6, 3, exposure, rand(), H, hemFlex, rand(), lobe );

			}

		}

		y += 0.55 + rand() * 0.3;
		whorl ++;

	}

	const top = axisAt( H );
	const topLobe = ( p ) => [ top.x - p.x, top.y - p.y, top.z - p.z, MAX_WHORLS - 1 ];
	card( b, top.clone().add( new THREE.Vector3( - 0.2, - 0.6, 0 ) ), new THREE.Vector3( 1, 0, 0 ), new THREE.Vector3( 0, 1, 0 ), 0.9, 1.3, 3, 1, rand(), H, hemFlex, rand(), topLobe );
	card( b, top.clone().add( new THREE.Vector3( - 0.2, - 0.6, 0 ) ), new THREE.Vector3( 0, 0, 1 ), new THREE.Vector3( 0, 1, 0 ), 0.9, 1.3, 3, 1, rand(), H, hemFlex, rand(), topLobe );

	return { geometry: b.build( 10, new THREE.Vector3( 0, H * 0.5, 0 ) ), triangles: b.idx.length / 3 };

}

// impostor bake variant: the dropped whorls collapsed onto the trunk (as the shader does near)
export function coniferVariantGeometry( geometry, variant ) {

	const pos = geometry.attributes.position;
	const lobe = geometry.attributes.aLobe;
	const src = pos.data.array;
	const stride = pos.data.stride;
	const data = new Float32Array( src );
	for ( let i = 0; i < pos.count; i ++ ) {

		const o = i * stride;
		const w = src[ o + lobe.offset + 3 ];
		if ( w < 0 || CONIFER_DROP[ variant * MAX_WHORLS + w ] !== 0 ) continue;
		data[ o + pos.offset ] += src[ o + lobe.offset ];
		data[ o + pos.offset + 1 ] += src[ o + lobe.offset + 1 ];
		data[ o + pos.offset + 2 ] += src[ o + lobe.offset + 2 ];

	}

	const ib = new THREE.InterleavedBuffer( data, stride );
	const g = new THREE.BufferGeometry();
	for ( const name of Object.keys( geometry.attributes ) ) {

		const a = geometry.attributes[ name ];
		g.setAttribute( name, new THREE.InterleavedBufferAttribute( ib, a.itemSize, a.offset ) );

	}

	g.setIndex( geometry.index );
	g.boundingSphere = geometry.boundingSphere.clone();
	return g;

}
