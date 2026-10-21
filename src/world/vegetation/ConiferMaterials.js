import { Texture } from '../../engine/gpu/Texture.js';
import { FullscreenPass } from '../../engine/render/FullscreenPass.js';
import { generateMipmaps } from '../../engine/gpu/Mipmaps.js';
import { ShaderModule } from '../../engine/gpu/Shader.js';
import { Material } from '../../engine/render/Material.js';
import { vegModule, f, C } from './VegNodes.js';
import { CONIFER_DROP, CONIFER_VARIANTS, MAX_WHORLS } from './ConiferGeometry.js';

// Needles and bark of the conifers (ConiferGeometry.js), near and far (impostors).
//
// NeedleAtlas: needle-spray cards baked once on the GPU, 2 x 2 tiles (4x supersampled, mipmapped):
//   0 white pine: brushy tufts of long soft needles at the twig ends (jittered, with sky holes)
//   1 hemlock: flat feathery fronds, short needles combed along the twigs, pale new growth at the tips
//   2, 3 the same, denser (cards pick by their random)
//   R coverage, G brightness (lighter tips / new growth) / 1.4, B per-spray random
// WGSL: fn conNeedleSample( st: vec2f, tile: f32 ) -> vec4f
//
// Instances: iDat = ( yaw, vertical scale (negative: hemlock), height, seed ).
// Parts (aMat.x): 0 pine bark, 1 pine needles, 2 hemlock bark, 3 hemlock needles.

const SIZE = 1024;
const px = 1 / ( SIZE / 2 );

const NEEDLES = /* wgsl */`
fn conSeg( p: vec2f, a: vec2f, d: vec2f, L: f32 ) -> vec2f {
	let t = clamp( dot( p - a, d ), 0.0, L );
	return vec2f( length( p - a - d * t ), t / L );
}

// white pine: tufts of ~16 long needles fanning from the twig ends ( coverage, bright, cell )
fn conPine( q: vec2f, G: f32, rot: f32 ) -> vec3f {
	let cuv = q * G;
	let c0 = floor( cuv );
	var o = vec3f( 0.0 );
	for ( var dy = -1; dy <= 1; dy++ ) {
		for ( var dx = -1; dx <= 1; dx++ ) {
			let cell = c0 + vec2f( f32( dx ), f32( dy ) );
			let h1 = vegHash12( cell + rot * 17.3 );
			let h2 = vegHash12( cell * 1.7 + rot * 3.1 + 5.2 );
			let h3 = vegHash12( cell * 2.3 + rot * 7.7 + 1.9 );
			if ( h3 < 0.14 ) { continue; }
			let base = ( cell + 0.5 + vec2f( h1 - 0.5, h2 - 0.5 ) * 0.5 ) / G;
			let da = 1.5708 + ( h1 - 0.5 ) * 2.4;
			let dir = vec2f( cos( da ), sin( da ) );
			// the twig behind the tuft
			let tw = conSeg( q, base - dir * ( 0.35 / G ), dir, 0.35 / G );
			if ( tw.x < 0.004 ) { o = vec3f( 1.0, 0.45, h1 ); }
			// the tuft's fan: partly covered between the needles (it reads solid once the needles are
			// smaller than a texel: the mips keep the tuft's mass)
			let rel = q - base;
			let rl = length( rel ) * G / 0.62;
			let ang = acos( clamp( dot( rel / max( length( rel ), 1e-5 ), dir ), -1.0, 1.0 ) );
			if ( rl < 0.92 && ang < 0.72 * ( 1.0 - rl * 0.25 ) && o.x < 0.5 ) { o = vec3f( 0.42, 0.62, h1 ); }
			for ( var k = 0; k < 22; k++ ) {
				let kh = vegHash12( vec2f( f32( k ), h2 * 31.0 ) );
				let a = da + ( f32( k ) / 21.0 - 0.5 ) * 1.5 + ( kh - 0.5 ) * 0.25;
				let d = vec2f( cos( a ), sin( a ) );
				let L = ( 0.55 + 0.45 * kh ) * 0.62 / G;
				let s = conSeg( q, base, d, L );
				if ( s.x < 0.0065 * ( 1.0 - 0.55 * s.y ) ) {
					o = vec3f( 1.0, 0.72 + 0.4 * s.y + ( kh - 0.5 ) * 0.15, h1 * 0.7 + kh * 0.3 );
				}
			}
		}
	}
	return o;
}

// hemlock: a frond (rachis up the card, alternate side twigs, short flat needles combed along them)
fn conHemlock( q: vec2f, G: f32, rot: f32 ) -> vec3f {
	let cuv = q * G;
	let c0 = floor( cuv );
	var o = vec3f( 0.0 );
	for ( var dy = -1; dy <= 0; dy++ ) {
		for ( var dx = -1; dx <= 1; dx++ ) {
			let cell = c0 + vec2f( f32( dx ), f32( dy ) );
			let h1 = vegHash12( cell + rot * 13.1 );
			let h2 = vegHash12( cell * 1.3 + rot * 5.7 + 2.2 );
			if ( h2 < 0.1 ) { continue; }
			let base = ( cell + vec2f( 0.5 + ( h1 - 0.5 ) * 0.4, 0.05 ) ) / G;
			let a = 1.5708 + ( h1 - 0.5 ) * 0.7;
			let d = vec2f( cos( a ), sin( a ) );
			let n = vec2f( -d.y, d.x );
			let Lf = ( 0.85 + 0.25 * h2 ) * 1.6 / G;
			let p = q - base;
			let u = dot( p, d );
			let v = dot( p, n );
			if ( u < 0.0 || u > Lf ) { continue; }
			let t = u / Lf;
			// the frond's outline: partly covered between the needles (mass in the mips)
			if ( abs( v ) < ( 0.3 / G ) * ( 1.0 - t ) + 0.02 / G && o.x < 0.5 ) { o = vec3f( 0.42, 0.7, h1 ); }
			// rachis with its needle comb
			let nl = 0.026 / G * ( 1.0 - t * 0.5 );
			if ( abs( v ) < 0.004 / G * 3.0 ) { o = vec3f( 1.0, 0.5, h1 ); }
			else if ( abs( v ) < nl && fract( u * G / 0.011 ) < 0.62 ) { o = vec3f( 1.0, 0.8 + t * 0.5, h1 ); }
			// side twigs every ~0.07 frond units, alternating, shorter toward the tip
			let sp = 0.075 / G;
			let k0 = floor( u / sp );
			for ( var j = -2; j <= 0; j++ ) {
				let k = k0 + f32( j );
				if ( k < 0.0 ) { continue; }
				let side = select( -1.0, 1.0, fract( k * 0.5 ) > 0.25 );
				let st = vec2f( k * sp, 0.0 );
				let sa = side * 0.95;
				let sd = vec2f( cos( sa ), sin( sa ) );
				let tk = k * sp / Lf;
				let Ls = ( 0.36 / G ) * ( 1.0 - tk ) * ( 0.75 + 0.25 * vegHash12( vec2f( k, h1 * 9.0 ) ) );
				let pl = vec2f( u, v ) - st;
				let su = dot( pl, sd );
				let sv = dot( pl, vec2f( -sd.y, sd.x ) );
				if ( su < 0.0 || su > Ls ) { continue; }
				let ts = su / Ls;
				let w = 0.022 / G * ( 1.0 - ts * 0.6 );
				if ( abs( sv ) < 0.0025 ) { o = vec3f( 1.0, 0.55, h1 ); }
				else if ( abs( sv ) < w && fract( su * G / 0.009 ) < 0.6 ) {
					// new growth: paler at the twig tips
					o = vec3f( 1.0, 0.78 + smoothstep( 0.6, 1.0, ts ) * 0.45 + ( h2 - 0.5 ) * 0.1, h1 );
				}
			}
		}
	}
	return o;
}
`;

const TILES = [ [ 'conPine', 3.2 ], [ 'conHemlock', 2.0 ], [ 'conPine', 4.2 ], [ 'conHemlock', 2.6 ] ];

export class NeedleAtlas {

	constructor() {

		this.texture = new Texture( { label: 'vegNeedleSprays', width: SIZE, height: SIZE, format: 'rgba8unorm', mips: true, usage: [ 'sample', 'render', 'copyDst', 'copySrc' ], sampler: 'anisoRepeat' } );
		this.baked = false;
		const self = this;
		this.module = new ShaderModule( {
			name: 'vegNeedleAtlas', deps: [ vegModule ],
			bindings: { vegNeedleTex: { texture: () => self.texture } },
			code: /* wgsl */`
// sample tile ( 0..3 ) at card uv st -> ( coverage, bright, cell, 1 )
fn conNeedleSample( st: vec2f, tile: f32 ) -> vec4f {
	let tuv = ( vec2f( fract( tile * 0.5 ) * 2.0, floor( tile * 0.5 ) ) + clamp( st, vec2f( 0.004 ), vec2f( 0.996 ) ) ) * 0.5;
	return textureSample( vegNeedleTex, smpAnisoRepeat, vec2f( tuv.x, 1.0 - tuv.y ) );
}
`,
		} );

	}

	bake() {

		let body = '';
		TILES.forEach( ( [ fn, G ], t ) => {

			body += `\tif ( tid == ${ t }.0 ) {\n`;
			for ( let s = 0; s < 4; s ++ ) {

				const ox = ( ( s % 2 ) - 0.5 ) * px * 0.5, oy = ( Math.floor( s / 2 ) - 0.5 ) * px * 0.5;
				body += `\t\t{ let r = ${ fn }( local + vec2f( ${ f( ox ) }, ${ f( oy ) } ), ${ f( G ) }, ${ f( t * 1.37 ) } ); if ( r.x > 0.0 ) { cov += r.x * 0.25; bright += r.y * 0.25 * r.x; cellR += r.z * 0.25 * r.x; } }\n`;

			}

			body += '\t}\n';

		} );

		const pass = new FullscreenPass( {
			label: 'veg needle atlas bake',
			modules: [ vegModule ],
			colorFormats: [ 'rgba8unorm' ],
			code: NEEDLES + /* wgsl */`
fn fragment( in: FSIn ) -> vec4f {
	let st = vec2f( in.uv.x, 1.0 - in.uv.y );
	let tile = floor( st * 2.0 );
	let tid = tile.x + tile.y * 2.0;
	let local = fract( st * 2.0 );
	var cov = 0.0; var bright = 0.0; var cellR = 0.0;
${ body }
	let inv = 1.0 / max( cov, 1e-3 );
	return vec4f( cov, bright * inv / 1.4, cellR * inv, 1.0 );
}
`,
		} );
		pass.render( { colorViews: [ this.texture ], clear: [ 0, 0, 0, 0 ] } );
		generateMipmaps( this.texture );
		this.baked = true;

	}

}

// the whorl masks of the crown variants (CONIFER_DROP) as u32 bitmasks
const masks = [];
for ( let v = 0; v < CONIFER_VARIANTS; v ++ ) {

	let m = 0;
	for ( let w = 0; w < MAX_WHORLS; w ++ ) if ( CONIFER_DROP[ v * MAX_WHORLS + w ] ) m |= 1 << w;
	masks.push( m >>> 0 );

}

export const coniferModule = new ShaderModule( {
	name: 'vegConifer',
	deps: [ vegModule ],
	code: /* wgsl */`
fn conVariantOf( seed: f32 ) -> f32 { return floor( fract( seed * 7.77 ) * ${ f( CONIFER_VARIANTS ) } ); }
fn conKeep( seed: f32, whorl: f32 ) -> f32 {
	let v = conVariantOf( seed );
	let m = select( select( ${ masks[ 2 ] }u, ${ masks[ 1 ] }u, v < 1.5 ), ${ masks[ 0 ] }u, v < 0.5 );
	return f32( ( m >> u32( clamp( whorl, 0.0, ${ f( MAX_WHORLS - 1 ) } ) ) ) & 1u );
}

// needle colour of an instance: white pine soft blue-green, hemlock dark green; per-instance tint
fn conNeedleColor( seed: f32, cr: f32, isHemlock: bool ) -> vec3f {
	let pine = mix( ${ C( 0x34502f ) }, ${ C( 0x4a6640 ) }, cr );
	let hem = mix( ${ C( 0x1f3a1c ) }, ${ C( 0x2c4a26 ) }, cr );
	let iv = vegHash12( vec2f( seed * 17.3, 4.1 ) );
	var c = select( pine, hem, isHemlock ) * ( iv * 0.3 + 0.8 );
	// a few pines yellowing in their oldest needles
	c = mix( c, ${ C( 0x6a6a38 ) }, step( 0.96, fract( cr * 9.1 ) ) * 0.4 * select( 1.0, 0.0, isHemlock ) );
	return c;
}

fn conBarkColor( n: f32, n2: f32, isHemlock: bool ) -> vec3f {
	let pine = mix( ${ C( 0x2e2924 ) }, ${ C( 0x544c43 ) }, n * 0.6 + n2 * 0.4 );
	let hem = mix( ${ C( 0x3a281f ) }, ${ C( 0x664636 ) }, n * 0.6 + n2 * 0.4 );
	return select( pine, hem, isHemlock );
}

fn conImpostorColor( seed: f32, cr: f32, leaf: f32, bright: f32, isHemlock: bool ) -> vec3f {
	let leafC = conNeedleColor( seed, cr, isHemlock ) * ( bright * 1.4 );
	let barkC = mix( ${ C( 0x1a1712 ) }, ${ C( 0x2b2620 ) }, ( bright - 0.4 ) / 0.5 );
	return mix( barkC, leafC, smoothstep( 0.05, 0.55, leaf ) );
}
`,
} );

const ATTRIBUTES = { iPos: 'vec4f', iDat: 'vec4f', aVeg: 'vec4f', aMat: 'vec4f', aLobe: 'vec4f' };

// near switch distances (m): pines, hemlocks (the impostors take over beyond)
export const CONIFER_NEAR = [ 80, 65 ];

const MASK = /* wgsl */`
fn conMask( in: FragInput, L: vec4f ) -> bool {
	let part = in.vs.vMat.x;
	let isBark = part < 0.5 || ( part > 1.5 && part < 2.5 );
	let nearD = select( ${ f( CONIFER_NEAR[ 0 ] ) }, ${ f( CONIFER_NEAR[ 1 ] ) }, in.vs.vIDat.y < 0.0 );
	let fade = smoothstep( nearD * ( 1.0 - VEG_LOD_BAND / 2.0 ), nearD * ( 1.0 + VEG_LOD_BAND / 2.0 ), length( vegParams.camPos - in.vs.vIPos ) );
	let facing = abs( dot( normalize( cross( dpdx( in.P ), dpdy( in.P ) ) ), in.V ) );
	let lod = log2( max( max( fwidth( in.uv.x ), fwidth( in.uv.y ) ) * 256.0, 1e-4 ) );
	let thr = mix( 0.5, 0.3, sat( lod / 4.0 ) ) + ( 1.0 - smoothstep( 0.08, 0.35, facing ) ) * 0.45;
	return ( isBark || L.x > thr ) && bayer4( in.pixel ) >= fade;
}
fn conLeaf( in: FragInput ) -> vec4f {
	let part = in.vs.vMat.x;
	let tile = select( 0.0, 1.0, part > 2.5 ) + select( 0.0, 2.0, in.vs.vMat.w > 0.6 );
	return conNeedleSample( in.uv, tile );
}
`;

export function createConiferMaterial( needles ) {

	const maskModule = new ShaderModule( { name: 'vegConiferMask', deps: [ coniferModule, needles.module ], code: MASK } );
	return new Material( {
		name: 'veg-conifer',
		side: 'double',
		modules: [ vegModule, coniferModule, needles.module, maskModule ],
		attributes: ATTRIBUTES,
		varyings: { vMat: 'vec4f', vIDat: 'vec4f', vIPos: 'vec3f', vHf: 'f32' },
		vertex: /* wgsl */`
	let iPos = v.iPos;
	let iDat = v.iDat;
	let veg = v.aVeg;
	let base = iPos.xyz;
	let sc = iPos.w;
	let Hh = iDat.z;
	let seed = iDat.w;
	let hf = veg.x;
	let flex = veg.y;
	let flut = veg.z;
	let ph = veg.w;
	var P = ( v.model * vec4f( v.position, 1.0 ) ).xyz;
	// the crown variant: a dropped whorl's limbs and needles fold onto the trunk
	let lobe = v.aLobe;
	if ( lobe.w >= 0.0 ) {
		let k = 1.0 - conKeep( seed, lobe.w );
		let yaw = iDat.x; let cy = cos( yaw ); let sy = sin( yaw );
		let sv = abs( iDat.y );
		P += vec3f( lobe.x * cy + lobe.z * sy, lobe.y * sv, lobe.z * cy - lobe.x * sy ) * sc * k;
	}
	let N = vegInstanceNormal( v.model, v.normal );
	let w = vegWindStrength();
	let g = vegGustAt( base.xz );
	let t = frame.time;
	let ph0 = seed * 6.2832;
	let h2 = hf * hf;
	// tall conifers sway slowly; the limbs bob, the needle sprays shiver
	let sway = ( w * w * 0.007 * ( g * 0.8 + 0.3 ) + sin( t * 0.6 + ph0 ) * w * 0.004 * ( g + 0.4 ) ) * Hh * h2;
	let swayP = sin( t * 0.47 + ph0 * 1.3 ) * w * 0.0018 * Hh * h2;
	let branch = sin( t * ( ph + 1.2 ) + ph * 20.0 + ph0 ) * flex * w * sc * 0.05 * ( g + 0.5 );
	let flutter = sin( t * 7.5 + ph * 50.0 + P.x * 1.9 + P.z * 2.3 ) * flut * sc * ( w * 0.02 + 0.003 );
	let pos = P + vegWindDir3() * sway + vegWindPerp3() * swayP + VEG_UP * branch + N * flutter;
	let dCam = length( vegParams.camPos - base );
	let nearD = select( ${ f( CONIFER_NEAR[ 0 ] ) }, ${ f( CONIFER_NEAR[ 1 ] ) }, iDat.y < 0.0 );
	let nearK = select( 0.0, 1.0, dCam < nearD * ( 1.0 + VEG_LOD_BAND / 2.0 ) );
	v.useWorld = true;
	v.worldPos = base + ( pos - base ) * nearK;
	v.worldNormal = N;
	o.vMat = v.aMat;
	o.vIDat = v.iDat;
	o.vIPos = v.iPos.xyz;
	o.vHf = v.aVeg.x;`,
		surface: /* wgsl */`
	let aMat = in.vs.vMat;
	let part = aMat.x;
	let ao = aMat.y;
	let cr = aMat.z;
	let seed = in.vs.vIDat.w;
	let isHem = part > 1.5;
	let isBark = part < 0.5 || ( part > 1.5 && part < 2.5 );
	let L = conLeaf( in );
	if ( ! conMask( in, L ) ) { discard; }
	var c = conNeedleColor( seed, cr, isHem ) * ( L.y * 1.4 );
	// sunlit outer tiers a little brighter and warmer, the inner crown deep
	c = mix( c, c * vec3f( 1.12, 1.15, 0.95 ), smoothstep( 0.6, 1.0, ao ) * 0.6 );
	var albedo = c * mix( 0.45, 1.0, ao );
	if ( isBark ) {
		let st = in.uv;
		let n = vegNoise( vec2f( st.x * 26.0, st.y * 1.6 + seed * 40.0 ) );
		let n2 = vegNoise( vec2f( st.x * 5.0, st.y * 0.5 ) );
		// deep vertical furrows
		let furrow = smoothstep( 0.35, 0.6, abs( fract( st.x * 9.0 + n2 * 0.6 ) - 0.5 ) * 2.0 );
		albedo = conBarkColor( n, n2, isHem ) * ( 0.7 + 0.3 * furrow );
	}
	s.albedo = albedo;
	s.ao = select( mix( 0.3, 1.0, ao ), smoothstep( 0.0, 0.6, in.vs.vHf ) * 0.5 + 0.35, isBark );
	s.roughness = select( 0.78, 0.94, isBark );
	s.metalness = 0.0;
	s.specularIntensity = 0.12;
	let geoN = normalize( in.vs.normal );
	s.normal = select( normalize( geoN + in.V * 0.6 ), in.N, isBark );
	s.translucency = vec3f( 0.0 );
	if ( ! isBark ) { s.translucency = vegTranslucency( albedo, geoN, 0.3, in.P ) * ( ao * 0.5 + 0.3 ); }`,
		shadow: 'return conMask( in, conLeaf( in ) );',
	} );

}

// unlit bake materials of the conifer impostors (same channels as the broadleaf ones)
export function createConiferBakeMaterials( needles ) {

	const head = /* wgsl */`
	let aMat = in.vs.vMat;
	let part = aMat.x;
	let isBark = part < 0.5 || ( part > 1.5 && part < 2.5 );
	let st = in.uv;
	let L = conNeedleSample( st, select( 0.0, 1.0, part > 2.5 ) );`;
	const make = ( which ) => new Material( {
		name: 'veg-conifer-bake-' + which,
		side: 'double',
		lit: false,
		modules: [ vegModule, needles.module ],
		attributes: { aMat: 'vec4f' },
		varyings: { vMat: 'vec4f', vLocalN: 'vec3f' },
		vertex: 'o.vMat = v.aMat; o.vLocalN = v.normal;',
		surface: head + '\n\tif ( ! ( isBark || L.x > 0.36 ) ) { discard; }',
		output: which === 'albedo' ? head + /* wgsl */`
	let barkN = vegNoise( vec2f( st.x * 26.0, st.y * 1.6 ) ) * 0.6 + vegNoise( vec2f( st.x * 5.0, st.y * 0.5 ) ) * 0.4;
	let bright = select( L.y, barkN * 0.5 + 0.4, isBark );
	r.color = vec4f( bright, select( 1.0, 0.0, isBark ), aMat.z, 1.0 );` : /* wgsl */`
	let aMat = in.vs.vMat;
	let part = aMat.x;
	let isBark = part < 0.5 || ( part > 1.5 && part < 2.5 );
	r.color = vec4f( normalize( in.vs.vLocalN ) * 0.5 + 0.5, select( aMat.y, 0.6, isBark ) );`,
	} );
	return { albedo: make( 'albedo' ), normal: make( 'normal' ) };

}
