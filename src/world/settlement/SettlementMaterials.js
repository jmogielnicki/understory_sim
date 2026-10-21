import { ShaderModule } from '../../engine/gpu/Shader.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { srgb } from '../terrain/TerrainShading.js';

// Materials of the earth homes and the communal buildings (the timber reuses the village wood material).
//
// Every settlement batch carries the GeoBuilder attributes: uv in metres, tint (vec3), vdata (vec4).
//
// STONE (pale, warm sandstone; one draw call for every stone pattern). vdata: x seed, y pattern, z wear
// (0 crisp .. 1 mossy and weathered), w unused. tint: multiplies the stone colour (per building).
//   pattern 0  coursed ashlar wall: u along the wall, v up (courses 0.42 - 0.56 m, blocks 0.7 - 1.6 m)
//   pattern 1  paving flags: uv = world xz (irregular rectangular flags in courses)
//   pattern 2  voussoirs of an arch ring: u along the arch (blocks ~0.6 m), v across the ring
//   pattern 3  dressed blocks (steps, copings, sills): one block per piece, bevelled at the uv edges;
//              vdata.w = the piece's length along u (m)
//   pattern 4  garden soil (raised beds)
//   pattern 5  granite boulder: grey, lichened (the glacial erratics, stream stones)
//   pattern 6  terracotta (plant pots): warm clay, a little salt bloom near the rim
//   pattern 7  turf: the planted top of a wall running back into the roof meadow (the meadow's tones)
// GLAZING: vdata: x seed, y lit (0..1, warm light inside), z 0 window / 1 door / 2 skylight / 3 hall window
// (framing drawn in the shader). uv: metres across the pane.
// GLOW: unlit light: the pale blue technology seams (vdata.x phase: they breathe slowly) and, with vdata.y = 1,
// the warm path lamps (steady, lit after dusk).

const STONE_WGSL = /* wgsl */`
const STN_A: vec3f = ${ srgb( 0.79, 0.7, 0.55 ) }; // cream
const STN_B: vec3f = ${ srgb( 0.75, 0.62, 0.44 ) };  // honey
const STN_C: vec3f = ${ srgb( 0.83, 0.77, 0.65 ) }; // pale
const STN_MOSS: vec3f = ${ srgb( 0.32, 0.38, 0.17 ) };
const STN_GRIME: vec3f = ${ srgb( 0.5, 0.46, 0.38 ) };

struct StnBlock { id: vec2f, edge: f32, local: vec2f, size: vec2f };

// rectangular blocks in courses: course height in [ch0, ch1], block length in [bl0, bl1]
fn stnBlocks( uv: vec2f, ch0: f32, ch1: f32, bl0: f32, bl1: f32, seed: f32 ) -> StnBlock {
	// courses: variable heights from a hash per course (find the course by stepping a mean height)
	let mean = ( ch0 + ch1 ) * 0.5;
	let c0 = floor( uv.y / mean );
	var row = c0;
	var y0 = c0 * mean;
	var h = mean;
	// jitter each course boundary by up to a quarter of a course (continuous: boundaries are per index)
	let b0 = c0 * mean + ( hash21( vec2f( c0, seed ) ) - 0.5 ) * ( ch1 - ch0 ) * 0.5;
	let b1 = ( c0 + 1.0 ) * mean + ( hash21( vec2f( c0 + 1.0, seed ) ) - 0.5 ) * ( ch1 - ch0 ) * 0.5;
	if ( uv.y < b0 ) {
		row = c0 - 1.0;
		y0 = ( c0 - 1.0 ) * mean + ( hash21( vec2f( c0 - 1.0, seed ) ) - 0.5 ) * ( ch1 - ch0 ) * 0.5;
		h = b0 - y0;
	} else if ( uv.y > b1 ) {
		row = c0 + 1.0;
		y0 = b1;
		h = ( c0 + 2.0 ) * mean + ( hash21( vec2f( c0 + 2.0, seed ) ) - 0.5 ) * ( ch1 - ch0 ) * 0.5 - b1;
	} else {
		y0 = b0;
		h = b1 - b0;
	}
	// blocks along the course: lengths from a hash per block, the course shifted by its own offset
	let bm = ( bl0 + bl1 ) * 0.5;
	let u = uv.x + hash21( vec2f( row, seed + 3.7 ) ) * bm * 3.0;
	let k0 = floor( u / bm );
	var x0 = k0 * bm + ( hash21( vec2f( k0, row + seed ) ) - 0.5 ) * ( bl1 - bl0 ) * 0.7;
	var x1 = ( k0 + 1.0 ) * bm + ( hash21( vec2f( k0 + 1.0, row + seed ) ) - 0.5 ) * ( bl1 - bl0 ) * 0.7;
	var kk = k0;
	if ( u < x0 ) {
		x1 = x0;
		x0 = ( k0 - 1.0 ) * bm + ( hash21( vec2f( k0 - 1.0, row + seed ) ) - 0.5 ) * ( bl1 - bl0 ) * 0.7;
		kk = k0 - 1.0;
	} else if ( u > x1 ) {
		x0 = x1;
		x1 = ( k0 + 2.0 ) * bm + ( hash21( vec2f( k0 + 2.0, row + seed ) ) - 0.5 ) * ( bl1 - bl0 ) * 0.7;
		kk = k0 + 1.0;
	}
	var o: StnBlock;
	o.id = vec2f( kk, row );
	o.local = vec2f( u - x0, uv.y - y0 );
	o.size = vec2f( x1 - x0, h );
	o.edge = min( min( o.local.x, o.size.x - o.local.x ), min( o.local.y, o.size.y - o.local.y ) );
	return o;
}

// bevelled block relief: 0 in the joint, rising over the bevel to 1 on the face (plus a soft pillow)
fn stnRelief( b: StnBlock, joint: f32, bevel: f32 ) -> f32 {
	let e = b.edge - joint;
	let bev = smoothstep( 0.0, bevel, e );
	let c = b.local / max( b.size, vec2f( 1e-3 ) ) - 0.5;
	let pillow = 1.0 - dot( c, c ) * 0.5;
	return select( 0.0, bev * ( 0.85 + 0.15 * pillow ), e > 0.0 );
}

struct StnSample { col: vec3f, rough: f32, h: f32, ao: f32 };

fn stnSample( uv: vec2f, P: vec3f, pattern: f32, seed: f32, wear: f32, tint: vec3f ) -> StnSample {
	var b: StnBlock;
	var joint = 0.011;
	var bevel = 0.035;
	if ( pattern < 0.5 ) {
		b = stnBlocks( uv, 0.42, 0.56, 0.7, 1.6, seed );
	} else if ( pattern < 1.5 ) {
		b = stnBlocks( uv, 0.55, 0.85, 0.6, 1.3, seed + 11.0 );
		joint = 0.014;
		bevel = 0.025;
	} else if ( pattern < 2.5 ) {
		b = stnBlocks( vec2f( uv.x, uv.y + 0.01 ), 50.0, 50.0, 0.5, 0.72, seed + 5.0 );
		bevel = 0.045;
	} else {
		// one dressed block per piece
		b.id = vec2f( seed, 0.0 );
		b.size = vec2f( 1e4, 1e4 );
		b.local = uv + 5000.0;
		b.edge = 1.0;
	}
	let rel = stnRelief( b, joint, bevel );
	let bh = hash21( b.id + vec2f( seed * 7.3, 1.7 ) );
	let bh2 = hash21( b.id + vec2f( 3.1, seed ) );
	// colour: cream, honey and pale blocks; mottling and fine grain inside each
	var col = mix( STN_A, STN_B, smoothstep( 0.35, 1.0, bh ) );
	col = mix( col, STN_C, smoothstep( 0.6, 0.95, bh2 ) * 0.7 );
	let mott = perlin2( uv * 2.7 + b.id * 1.31 ) * 0.5 + perlin2( uv * 9.0 + 3.1 ) * 0.25;
	col = col * ( 1.0 + mott * 0.12 ) * tint;
	// pits and grain
	let grain = perlin2( uv * 37.0 + b.id ) * 0.5 + 0.5;
	col = col * ( 0.94 + grain * 0.08 );
	// joints: deep, darker; a grimy rim along the bottom of each block
	let inJoint = 1.0 - smoothstep( joint * 0.6, joint + 0.006, b.edge );
	col = mix( col, col * vec3f( 0.58, 0.55, 0.5 ), inJoint );
	// weathering: moss and grime creep up from the ground and in from the joints where wear is high
	let lowK = 1.0 - smoothstep( 0.0, 0.9, uv.y );
	let mossN = perlin2( uv * 1.3 + seed ) * 0.5 + 0.5;
	let moss = sat( wear * ( lowK * 0.8 + inJoint * 0.6 + smoothstep( 0.62, 0.8, mossN ) * 0.35 ) * smoothstep( 0.3, 0.6, mossN + lowK * 0.3 ) );
	col = mix( col, STN_GRIME * tint, lowK * 0.25 * wear );
	col = mix( col, STN_MOSS, moss * 0.7 );
	var o: StnSample;
	o.col = col;
	o.rough = mix( 0.82, 0.92, inJoint ) - grain * 0.05;
	o.h = rel * 0.03 + ( grain - 0.5 ) * 0.0015 + mott * 0.003;
	o.ao = mix( 1.0, 0.55, inJoint );
	return o;
}

fn stnSoil( uv: vec2f ) -> StnSample {
	let n = perlin2( uv * 6.0 ) * 0.5 + 0.5;
	let n2 = perlin2( uv * 23.0 + 4.0 ) * 0.5 + 0.5;
	var o: StnSample;
	o.col = mix( ${ srgb( 0.12, 0.085, 0.06 ) }, ${ srgb( 0.24, 0.17, 0.11 ) }, n * 0.6 + n2 * 0.4 );
	o.rough = 0.95;
	o.h = n2 * 0.01 + n * 0.02;
	o.ao = 0.8 + n2 * 0.2;
	return o;
}

fn stnGranite( P: vec3f, seed: f32 ) -> StnSample {
	let q = P * 1.7 + seed * 13.0;
	let n = perlin3( q ) * 0.5 + 0.5;
	let n2 = perlin3( q * 5.3 ) * 0.5 + 0.5;
	let speck = smoothstep( 0.62, 0.7, perlin3( P * 41.0 ) * 0.5 + 0.5 );
	var c = mix( ${ srgb( 0.36, 0.35, 0.33 ) }, ${ srgb( 0.56, 0.54, 0.51 ) }, n * 0.7 + n2 * 0.3 );
	c = mix( c, ${ srgb( 0.2, 0.19, 0.18 ) }, speck * 0.5 );
	// lichen crusts: pale grey-green and a few ochre rosettes
	let lich = smoothstep( 0.55, 0.7, perlin3( P * 0.9 + seed * 3.0 ) * 0.5 + 0.5 + n2 * 0.15 );
	c = mix( c, ${ srgb( 0.66, 0.7, 0.6 ) }, lich * 0.65 );
	c = mix( c, ${ srgb( 0.62, 0.55, 0.3 ) }, smoothstep( 0.78, 0.86, perlin3( P * 2.3 + 7.0 ) * 0.5 + 0.5 ) * 0.5 );
	var o: StnSample;
	o.col = c;
	o.rough = 0.88 - lich * 0.05;
	o.h = n2 * 0.03 + n * 0.06;
	o.ao = 1.0;
	return o;
}
`;

export const stoneModule = new ShaderModule( { name: 'settlementStone', deps: [ commonModule ], code: STONE_WGSL } );

const ATTRIBUTES = { tint: 'vec3f', vdata: 'vec4f' };
const VARYINGS = { vTint: 'vec3f', vData: 'vec4f' };
const PASS = '\to.vTint = v.tint;\n\to.vData = v.vdata;\n';

export function createStoneMaterial() {

	const m = standard( {
		name: 'SettlementStone', roughness: 0.88, metalness: 0,
		attributes: ATTRIBUTES, varyings: VARYINGS,
	} );
	m.modules = [ commonModule, stoneModule ];
	m.vertex = PASS;
	m.surface = /* wgsl */`
	let d = in.vs.vData;
	let pattern = d.y;
	var st: StnSample;
	var hd = 0.0;
	if ( pattern > 6.5 ) {
		let n = perlin2( in.P.xz * 0.9 ) * 0.5 + 0.5;
		let n2 = perlin2( in.P.xz * 7.0 + 3.0 ) * 0.5 + 0.5;
		st.col = mix( ${ srgb( 0.2, 0.3, 0.09 ) }, ${ srgb( 0.33, 0.42, 0.14 ) }, n * 0.6 + n2 * 0.4 );
		st.col = mix( st.col, ${ srgb( 0.42, 0.42, 0.2 ) }, smoothstep( 0.7, 0.9, n2 ) * 0.4 );
		st.rough = 0.95;
		st.h = n2 * 0.02;
		st.ao = 0.85 + n2 * 0.15;
	} else if ( pattern > 5.5 ) {
		let n = perlin2( in.uv * vec2f( 3.0, 9.0 ) + d.x * 11.0 ) * 0.5 + 0.5;
		st.col = mix( ${ srgb( 0.6, 0.33, 0.2 ) }, ${ srgb( 0.72, 0.43, 0.27 ) }, n );
		st.col = mix( st.col, ${ srgb( 0.78, 0.72, 0.62 ) }, smoothstep( 0.7, 0.95, in.uv.x ) * 0.25 * n );
		st.rough = 0.85;
		st.h = n * 0.002;
		st.ao = 1.0;
	} else if ( pattern > 4.5 ) {
		st = stnGranite( in.P, d.x );
	} else if ( pattern > 3.5 ) {
		st = stnSoil( in.uv );
	} else {
		st = stnSample( in.uv, in.P, pattern, d.x, d.z, in.vs.vTint );
	}
	// relief as a uv-space height: slopes from screen derivatives of the sampled height
	let dhdx = dpdx( st.h );
	let dhdy = dpdy( st.h );
	let dpx = dpdx( in.P );
	let dpy = dpdy( in.P );
	let N0 = normalize( in.N );
	let r1 = cross( dpy, N0 );
	let r2 = cross( N0, dpx );
	let det = dot( dpx, r1 );
	let grad = sign( det ) * ( dhdx * r1 + dhdy * r2 );
	s.normal = normalize( abs( det ) * N0 - grad * 1.0 );
	s.albedo = st.col;
	s.roughness = st.rough;
	s.ao = st.ao;
`;
	return m;

}

export function createGlazingMaterial() {

	const m = standard( {
		name: 'SettlementGlazing', roughness: 0.05, metalness: 0,
		attributes: ATTRIBUTES, varyings: VARYINGS,
	} );
	m.modules = [ commonModule ];
	m.vertex = PASS;
	m.surface = /* wgsl */`
	let d = in.vs.vData;
	let seed = d.x;
	let lit = d.y;
	let uv = in.uv;
	// a lived-in room behind the glass: warm plaster, the shapes of furniture and plants, a pool of lamp light
	let room = perlin2( uv * vec2f( 0.9, 1.6 ) + seed * 9.0 ) * 0.5 + 0.5;
	let low = smoothstep( 1.4, 0.2, uv.y );
	var inside = mix( ${ srgb( 0.8, 0.52, 0.26 ) }, ${ srgb( 0.98, 0.78, 0.48 ) }, room );
	inside = mix( inside, inside * 0.3, smoothstep( 0.55, 0.7, room ) * low * 0.8 );
	let leaves = smoothstep( 0.62, 0.72, perlin2( uv * 3.3 + seed * 4.0 ) * 0.5 + 0.5 ) * low;
	inside = mix( inside, ${ srgb( 0.16, 0.24, 0.1 ) }, leaves * 0.7 );
	// the room glows warm by day (it is lit inside, and the sun reaches in) and brightly after dusk; the pane
	// reflects the sky over it (low roughness)
	let night = smoothstep( 0.1, 0.7, frame.night );
	// the halls' great windows (kind 3) carry their timber framing in the shader: mullions ~1.1 m apart,
	// transoms every 2.2 m (uv in metres over the shell)
	var frameK = 0.0;
	if ( d.z > 2.5 ) {
		let fu = abs( fract( uv.x / 1.1 + 0.5 ) - 0.5 ) * 1.1;
		let fv = abs( fract( uv.y / 2.2 ) - 0.5 ) * 2.2;
		let wu = fwidth( uv.x ) + 0.045;
		frameK = max( 1.0 - smoothstep( wu, wu + 0.02, fu ), 1.0 - smoothstep( 0.05, 0.07, fv ) );
	}
	s.albedo = mix( inside * 0.05, ${ srgb( 0.36, 0.25, 0.16 ) }, frameK );
	s.roughness = mix( 0.03 + room * 0.03, 0.7, frameK );
	s.emissive = inside * lit * mix( 1.6, 4.5, night ) * ( 1.0 - frameK );
	s.specularIntensity = 1.0;
`;
	return m;

}

export function createGlowMaterial() {

	const m = standard( {
		name: 'SettlementGlow', roughness: 1, metalness: 0,
		attributes: ATTRIBUTES, varyings: VARYINGS,
	} );
	m.lit = false;
	m.vertex = PASS;
	m.output = /* wgsl */`
	// pale, breathing blue: brighter at night, gently visible by day (vData.y = 1: a steady lamp, which
	// shows only after dusk)
	let lamp = in.vs.vData.y > 0.5;
	let breathe = select( sin( frame.time * 0.9 + in.vs.vData.x * 6.28 ) * 0.25 + 0.75, 1.0, lamp );
	let night = smoothstep( 0.1, 0.7, frame.night );
	let k = select( mix( 1.6, 4.0, night ), mix( 0.15, 6.0, night ), lamp ) * breathe;
	r.color = vec4f( in.vs.vTint * k, 1.0 );
`;
	return m;

}

// sailcloth: off-white dacron with seams across the sail, a little translucent against the sun
export function createSailMaterial() {

	const m = standard( {
		name: 'SettlementSails', roughness: 0.7, metalness: 0, side: 'double',
		attributes: ATTRIBUTES, varyings: VARYINGS,
	} );
	m.modules = [ commonModule ];
	m.vertex = PASS;
	m.surface = /* wgsl */`
	let seams = smoothstep( 0.012, 0.0, abs( fract( ( in.uv.x - in.uv.y ) * 7.0 ) - 0.5 ) - 0.48 );
	s.albedo = in.vs.vTint * ( 0.93 + perlin2( in.uv * 30.0 ) * 0.04 ) * ( 1.0 - seams * 0.12 );
	s.roughness = 0.7;
	s.translucency = in.vs.vTint * 0.35;
`;
	return m;

}
