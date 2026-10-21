import { Matrix4, Mesh, Vector3 } from '../../engine/index.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { Batch, Part } from '../village/GeoBuilder.js';
import { srgb } from '../terrain/TerrainShading.js';

// Trailing vines over the homes (docs/REFERENCE.md: greenery and flowers spill from the roof meadows over the
// arch crowns and the tops of the walls). Each strand is a hanging strip a little in front of the stone;
// its leaves are drawn in the fragment shader: a wandering stem with small ivy-like leaves on alternate
// sides, a denser mat at the top thinning to single tendrils, now and then a little purple or white flower.
// Alpha tested (discard), double sided, one draw call for the whole village.
//
// uv: u across the strip (0..1), v down it (metres from the top); vdata: x seed, y strip width (m),
// z strip length (m), w flower share.

const DRAPE = /* wgsl */`
	let d = in.vs.vData;
	let seed = d.x;
	let W = d.y;
	let Lh = d.z;
	let u = ( in.uv.x - 0.5 ) * W; // metres across
	let v = in.uv.y; // metres down
	let t = v / Lh;
	// a few stems wander down the strip; the mat at the top is wider than the tendrils below
	var cov = 0.0;
	var bright = 0.0;
	var flower = 0.0;
	let reach = mix( W * 0.5, W * 0.12, smoothstep( 0.0, 0.85, t ) );
	for ( var k = 0; k < 3; k++ ) {
		let ks = f32( k );
		let stemLen = Lh * ( 0.55 + 0.45 * hash21( vec2f( seed * 9.1, ks ) ) );
		if ( v > stemLen ) { continue; }
		let sx = ( hash21( vec2f( seed, ks * 3.1 ) ) - 0.5 ) * W * 0.6 + sin( v * 2.3 + ks * 2.0 + seed * 9.0 ) * 0.06;
		let du = u - sx;
		// leaves every ~7 cm along the stem, alternating sides
		let idx = floor( v / 0.11 );
		for ( var j = 0; j < 2; j++ ) {
			let li = idx + f32( j );
			let side = select( -1.0, 1.0, fract( li * 0.5 ) > 0.25 );
			let lh = hash21( vec2f( li, seed * 3.3 + ks ) );
			let lc = vec2f( sx + side * ( 0.06 + lh * 0.03 ), li * 0.11 + 0.03 );
			let q = vec2f( u, v ) - lc;
			let ang = side * 0.9 + ( lh - 0.5 ) * 0.6;
			let ca = cos( ang ); let sa = sin( ang );
			let r = vec2f( q.x * ca + q.y * sa, - q.x * sa + q.y * ca );
			let sz = 0.075 * ( 1.1 - ( li * 0.11 / stemLen ) * 0.4 );
			let e = length( r / vec2f( sz, sz * 0.62 ) );
			if ( e < 1.0 ) {
				cov = 1.0;
				bright = 0.75 + lh * 0.35 + ( 1.0 - e ) * 0.15;
				flower = select( 0.0, 1.0 + step( 0.5, fract( lh * 13.0 ) ), fract( lh * 7.3 ) < d.w );
			}
		}
		if ( abs( du ) < 0.012 ) { cov = 1.0; bright = 0.55; }
	}
	// the dense mat at the top (sampled as noise blobs), feathering out
	let mat0 = perlin2( vec2f( u, v ) * 5.5 + seed * 7.0 ) * 0.5 + 0.5 + perlin2( vec2f( u, v ) * 17.0 + seed ) * 0.12;
	if ( mat0 > 0.3 + t * 0.9 && abs( u ) < reach ) { cov = 1.0; bright = 0.6 + mat0 * 0.4; }
	if ( cov < 0.5 ) { discard; }
	var c = mix( ${ srgb( 0.12, 0.22, 0.06 ) }, ${ srgb( 0.3, 0.42, 0.12 ) }, sat( bright - 0.55 ) * 1.6 ) * bright;
	c = select( c, mix( ${ srgb( 0.52, 0.38, 0.78 ) }, ${ srgb( 0.95, 0.94, 0.9 ) }, step( 1.5, flower ) ), flower > 0.5 );
	s.albedo = c;
	s.roughness = 0.6;
	s.metalness = 0.0;
	s.normal = normalize( normalize( in.N ) + in.V * 0.5 + vec3f( 0.0, 0.4, 0.0 ) );
	s.translucency = c * 0.25;
`;

const IDENTITY = new Matrix4();

export function createDrapeMaterial() {

	// alphaTest > 0: the shadow passes run the surface too (its discard cuts the leaves out of the shadow)
	const m = standard( { name: 'VillageDrapes', roughness: 0.6, metalness: 0, side: 'double', alphaTest: 0.5, attributes: { tint: 'vec3f', vdata: 'vec4f' }, varyings: { vData: 'vec4f' } } );
	m.modules = [ commonModule ];
	m.vertex = '\to.vData = v.vdata;\n';
	m.surface = DRAPE;
	return m;

}

export class Drapes {

	constructor() {

		this.batch = new Batch();

	}

	// a strand hanging from world point top, down `len` metres, `w` wide, facing along n (horizontal unit)
	strand( top, n, len, w, seed, flowers = 0.06 ) {

		const right = new Vector3( - n.z, 0, n.x );
		const segs = 3;
		const P = [], N = [], UV = [], I = [];
		for ( let j = 0; j <= segs; j ++ ) {

			const t = j / segs;
			// hangs a little out from the wall, swinging back in toward the bottom
			const out = Math.sin( t * Math.PI ) * 0.06 + 0.03;
			const c = top.clone().addScaledVector( n, out ).add( new Vector3( 0, - len * t, 0 ) );
			for ( const sd of [ - 0.5, 0.5 ] ) {

				const p = c.clone().addScaledVector( right, sd * w );
				P.push( p.x, p.y, p.z );
				N.push( n.x, n.y, n.z );
				UV.push( sd + 0.5, len * t );

			}

			if ( j > 0 ) {

				const a = ( j - 1 ) * 2;
				I.push( a, a + 2, a + 3, a, a + 3, a + 1 );

			}

		}

		const part = new Part( P, N, UV, I );
		this.batch.add( part, IDENTITY, [ 1, 1, 1 ], [ seed, w, len, flowers ] );

	}

	mesh() {

		if ( ! this.batch.vcount ) return null;
		const m = new Mesh( this.batch.build(), createDrapeMaterial() );
		m.name = 'village_drapes';
		m.castShadow = true;
		m.receiveShadow = true;
		m.staticVelocity = true;
		return m;

	}

}
