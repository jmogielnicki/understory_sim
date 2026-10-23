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
//   pattern 9  big rounded blocks in courses (the terraces' retaining walls): u along the wall, v up
//   pattern 10 a sandstone boulder (HomeGarden.js): world-space bands, moss on top
//   pattern 8  a home's shell (Home.js): lime plaster, hand-finished, warm cream, and where vdata.z -> 1 the
//              planted cap over it (a dense mat of leaves, clover and small flowers); vdata.w = height above
//              the cap's edge (m): below it, trailing stems hang down over the plaster
// GLAZING: vdata: x seed, y lit (0..1, warm light inside), z 0 window / 1 door or lantern / 2 skylight
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
	return select( 0.0, bev * ( 0.75 + 0.25 * pillow ), e > 0.0 );
}

struct StnSample { col: vec3f, rough: f32, h: f32, ao: f32 };

fn stnSample( uv: vec2f, P: vec3f, pattern: f32, seed: f32, wear: f32, tint: vec3f ) -> StnSample {
	var b: StnBlock;
	// (docs/REFERENCE.md: large, softly rounded blocks with fine joints)
	var joint = 0.007;
	var bevel = 0.07;
	if ( pattern < 0.5 ) {
		b = stnBlocks( uv, 0.62, 0.86, 1.1, 2.3, seed );
	} else if ( pattern < 1.5 ) {
		b = stnBlocks( uv, 0.55, 0.85, 0.6, 1.3, seed + 11.0 );
		joint = 0.014;
		bevel = 0.025;
	} else if ( pattern < 2.5 ) {
		b = stnBlocks( vec2f( uv.x, uv.y + 0.01 ), 50.0, 50.0, 0.85, 1.15, seed + 5.0 );
		bevel = 0.08;
	} else if ( pattern > 8.5 ) {
		// big rounded blocks (terrace walls): pillowed, deep soft joints
		b = stnBlocks( uv, 0.36, 0.52, 0.55, 1.05, seed + 2.0 );
		joint = 0.03;
		bevel = 0.05;
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
	// (the blocks differ only a little: the wall reads as one warm stone)
	var col = mix( STN_A, STN_B, smoothstep( 0.35, 1.0, bh ) * 0.55 );
	col = mix( col, STN_C, smoothstep( 0.6, 0.95, bh2 ) * 0.5 );
	let mott = perlin2( uv * 2.7 + b.id * 1.31 ) * 0.5 + perlin2( uv * 9.0 + 3.1 ) * 0.25;
	col = col * ( 1.0 + mott * 0.12 ) * tint;
	// pits and grain
	let grain = perlin2( uv * 37.0 + b.id ) * 0.5 + 0.5;
	col = col * ( 0.94 + grain * 0.08 );
	// joints: deep, darker; a grimy rim along the bottom of each block
	let inJoint = 1.0 - smoothstep( joint * 0.6, joint + 0.006, b.edge );
	col = mix( col, col * select( vec3f( 0.8, 0.77, 0.72 ), vec3f( 0.45, 0.42, 0.36 ), pattern > 8.5 ), inJoint );
	// (the terrace walls' blocks differ more: honey, cream, a few rusty ones)
	col = select( col, col * mix( vec3f( 0.9, 0.86, 0.8 ), vec3f( 1.06, 1.02, 0.96 ), bh2 ), pattern > 8.5 );
	// weathering: moss and grime creep up from the ground and in from the joints where wear is high
	let lowK = 1.0 - smoothstep( 0.0, 0.9, uv.y );
	let mossN = perlin2( uv * 1.3 + seed ) * 0.5 + 0.5;
	let moss = sat( wear * ( lowK * 0.8 + inJoint * 0.6 + smoothstep( 0.62, 0.8, mossN ) * 0.35 ) * smoothstep( 0.3, 0.6, mossN + lowK * 0.3 ) );
	col = mix( col, STN_GRIME * tint, lowK * 0.25 * wear );
	col = mix( col, STN_MOSS, moss * 0.7 );
	var o: StnSample;
	o.col = col;
	o.rough = mix( 0.82, 0.92, inJoint ) - grain * 0.05;
	// (the terrace walls' blocks are pillowed: a rounded face, not a flat one)
	let c2 = b.local / max( b.size, vec2f( 1e-3 ) ) - 0.5;
	let pil = select( 0.0, ( 1.0 - dot( c2, c2 ) * 2.6 ) * smoothstep( 0.0, 0.03, b.edge ), pattern > 8.5 );
	o.h = rel * select( 0.03, 0.012, pattern > 8.5 ) + pil * 0.07 + ( grain - 0.5 ) * 0.0015 + mott * 0.003;
	o.ao = mix( 1.0, 0.75, inJoint );
	return o;
}

// lime plaster over the shell, and the planted cap (turf: 0..1; above: metres above the cap's edge)
fn stnShell( P: vec3f, uv: vec2f, seed: f32, turf: f32, above: f32, N: vec3f, tint: vec3f ) -> StnSample {
	// ---- plaster: broad soft trowel clouds, a fine sanded grain, pale where it faces the sky
	let cloud = perlin3( P * 0.55 + seed * 17.0 ) * 0.6 + perlin3( P * 1.9 ) * 0.4;
	let grain = perlin3( P * 23.0 ) * 0.5 + 0.5;
	let trowel = perlin3( P * vec3f( 4.0, 1.3, 4.0 ) + 3.0 );
	var pc = mix( ${ srgb( 0.8, 0.65, 0.44 ) }, ${ srgb( 0.88, 0.77, 0.57 ) }, sat( cloud * 0.8 + 0.5 ) );
	pc = pc * ( 0.95 + grain * 0.07 + trowel * 0.025 ) * tint;
	// weather: a little grime low down and soft rain-darkening under the cap's lip
	let low = 1.0 - smoothstep( 0.0, 0.7, uv.y );
	pc = mix( pc, pc * ${ srgb( 0.78, 0.74, 0.66 ) }, low * 0.35 );
	let drip = smoothstep( -1.4, -0.1, above ) * smoothstep( 0.45, 0.8, perlin3( P * vec3f( 5.0, 0.45, 5.0 ) ) * 0.5 + 0.5 );
	pc = mix( pc, pc * 0.86, drip * 0.4 );
	// ---- the planted cap: leaves (clumps of light and dark), clover, small white and violet flowers
	let q = P * 6.5;
	let l1 = perlin3( q ) * 0.5 + 0.5;
	let l2 = perlin3( q * 2.3 + 7.0 ) * 0.5 + 0.5;
	let clump = perlin3( P * 0.8 + seed * 5.0 ) * 0.5 + 0.5;
	var tc = mix( ${ srgb( 0.1, 0.17, 0.05 ) }, ${ srgb( 0.3, 0.42, 0.14 ) }, smoothstep( 0.25, 0.75, l1 * 0.7 + l2 * 0.3 ) );
	// (sunlit tops: a fresher yellow-green, as in the painting; the lip's underside stays dark)
	tc = mix( tc, tc * vec3f( 1.25, 1.2, 0.95 ), smoothstep( 0.2, 0.8, N.y ) * 0.6 );
	tc = mix( tc, ${ srgb( 0.48, 0.56, 0.2 ) }, smoothstep( 0.68, 0.88, l2 ) * 0.6 * smoothstep( 0.0, 0.6, N.y ) );
	tc = mix( tc, tc * vec3f( 1.12, 1.05, 0.8 ), clump * 0.5 );
	let fl = perlin3( P * 17.0 + seed * 3.0 ) * 0.5 + 0.5;
	let flower = smoothstep( 0.8, 0.85, fl ) * smoothstep( 0.25, 0.65, clump );
	let violet = step( 0.5, fract( floor( P.x * 3.0 ) * 0.37 + floor( P.z * 3.0 ) * 0.71 ) );
	tc = mix( tc, mix( ${ srgb( 0.9, 0.88, 0.8 ) }, ${ srgb( 0.55, 0.42, 0.8 ) }, violet ), flower * 0.85 );
	// ---- where they meet: the cap's ragged edge, and stems trailing over the plaster below it
	// (strands: a 3d noise squeezed vertically, so they run down the wall; most stop short)
	let strand = perlin3( P * vec3f( 3.2, 0.35, 3.2 ) + seed * 7.0 ) * 0.5 + 0.5;
	let hang = smoothstep( 0.55, 0.85, strand ) * 1.1 + ( perlin3( P * 1.1 + 4.0 ) * 0.5 + 0.5 ) * 0.25 - 0.1;
	let trail = select( 0.0, smoothstep( - hang, - hang + 0.1, above ) * smoothstep( 0.4, 0.55, l1 * 0.6 + l2 * 0.4 + 0.15 ), above < 0.0 );
	let edge = turf + ( l1 - 0.5 ) * 0.5;
	let tk = max( smoothstep( 0.45, 0.55, edge ), trail );
	var o: StnSample;
	o.col = mix( pc, tc, tk );
	o.rough = mix( 0.86 - grain * 0.06, 0.78, tk );
	o.h = mix( cloud * 0.004 + grain * 0.0015 + trowel * 0.002, l1 * 0.05 + l2 * 0.025, tk );
	o.ao = mix( 1.0, 0.55 + l1 * 0.45, tk );
	return o;
}

// a sandstone boulder: honey and cream in soft bands, darker hollows, moss and lichen on its top
fn stnBoulder( P: vec3f, seed: f32, N: vec3f ) -> StnSample {
	let n = perlin3( P * 1.3 + seed * 11.0 ) * 0.5 + 0.5;
	let n2 = perlin3( P * 6.0 ) * 0.5 + 0.5;
	let band = sin( P.y * 7.0 + perlin3( P * 0.8 ) * 3.0 ) * 0.5 + 0.5;
	var c = mix( ${ srgb( 0.66, 0.53, 0.36 ) }, ${ srgb( 0.82, 0.71, 0.53 ) }, n * 0.6 + band * 0.25 + n2 * 0.15 );
	let top = smoothstep( 0.45, 0.9, N.y );
	let moss = top * smoothstep( 0.5, 0.7, perlin3( P * 2.2 + seed ) * 0.5 + 0.5 + n2 * 0.2 );
	c = mix( c, ${ srgb( 0.27, 0.34, 0.13 ) }, moss * 0.8 );
	c = mix( c, ${ srgb( 0.75, 0.75, 0.66 ) }, smoothstep( 0.8, 0.88, n2 ) * 0.3 * ( 1.0 - moss ) );
	var o: StnSample;
	o.col = c;
	o.rough = 0.85;
	o.h = n2 * 0.02 + n * 0.03;
	o.ao = 0.85 + n * 0.15;
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
	if ( pattern > 7.5 && pattern < 8.5 ) {
		st = stnShell( in.P, in.uv, d.x, d.z, d.w, normalize( in.N ), in.vs.vTint );
	} else if ( pattern > 9.5 ) {
		st = stnBoulder( in.P, d.x, normalize( in.N ) );
	} else if ( pattern > 8.5 ) {
		st = stnSample( in.uv, in.P, pattern, d.x, d.z, in.vs.vTint );
	} else if ( pattern > 6.5 && pattern < 7.5 ) {
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
	// a home's arch (vData.w packs its rise and half-span): the vaulted room behind the glass, found by
	// tracing the view ray from the pane (uv: metres from the arch's centre, above its floor) into a
	// half-elliptic vault ~2.2 half-spans deep: plastered vault with faint stone ribs, a plank floor and a
	// rug, a back wall with shelves or a doorway on, a table and chairs and a plant part way in, and a
	// pendant lamp under the crown. Lit by the window by day (falling off toward the back) and by the
	// lamp after dusk.
	var illum = 1.0;
	let traced = d.z < 1.5 && d.w > 1.0;
	if ( traced ) {
		let bi = floor( d.w / 100.0 ) / 100.0;
		let ai = d.w - floor( d.w / 100.0 ) * 100.0;
		let D = 2.2 * ai + 1.2;
		let Nw = normalize( in.N );
		let Tw = normalize( vec3f( Nw.z, 0.0, - Nw.x ) );
		let Vw = - normalize( in.V );
		let rd = vec3f( dot( Vw, Tw ), Vw.y, min( dot( Vw, Nw ), -0.02 ) );
		let ro = vec3f( uv.x, uv.y, 0.0 );
		let h1 = hash21( vec2f( floor( seed * 7.0 ), 3.1 ) );
		let h2 = hash21( vec2f( floor( seed * 7.0 ), 8.7 ) );
		var t = D / - rd.z;
		var hit = 2; // 0 vault, 1 floor, 2 back wall, 3 furniture, 4 lamp
		if ( rd.y < -1e-4 ) { let tf = - ro.y / rd.y; if ( tf < t ) { t = tf; hit = 1; } }
		let ia = 1.0 / ( ai * ai ); let ib = 1.0 / ( bi * bi );
		let qa = rd.x * rd.x * ia + rd.y * rd.y * ib;
		let qb = 2.0 * ( ro.x * rd.x * ia + ro.y * rd.y * ib );
		let qc = ro.x * ro.x * ia + ro.y * ro.y * ib - 1.0;
		let disc = qb * qb - 4.0 * qa * qc;
		if ( disc > 0.0 && qa > 1e-6 ) { let tv = ( - qb + sqrt( disc ) ) / ( 2.0 * qa ); if ( tv > 0.0 && tv < t ) { t = tv; hit = 0; } }
		// furniture: a table with two chairs and a potted plant, cut out of a plane part way in
		let zc = 2.0 + h1 * 1.6;
		let tc = zc / - rd.z;
		var fcol = vec3f( 0.0 );
		if ( tc < t ) {
			let c = ro + rd * tc;
			let tx = ( h2 - 0.5 ) * ai * 0.6;
			let dxT = abs( c.x - tx );
			let top = dxT < 0.85 && abs( c.y - 0.74 ) < 0.035;
			let legs = abs( dxT - 0.75 ) < 0.035 && c.y < 0.74;
			let chairX = abs( dxT - 1.15 );
			let chair = ( chairX < 0.22 && abs( c.y - 0.45 ) < 0.03 ) || ( abs( chairX - 0.2 ) < 0.03 && c.y < 0.95 && dxT > 1.15 );
			let px = select( ai * 0.62, - ai * 0.62, h2 > 0.5 );
			let leaf = length( ( c.xy - vec2f( px, 1.05 ) ) / vec2f( 0.42, 0.55 ) ) < 1.0 + perlin2( c.xy * 6.0 + seed ) * 0.35;
			let pot = abs( c.x - px ) < 0.2 - ( 0.45 - c.y ) * 0.1 && c.y < 0.45;
			if ( top || legs || chair ) { fcol = ${ srgb( 0.32, 0.2, 0.11 ) }; t = tc; hit = 3; }
			else if ( pot ) { fcol = ${ srgb( 0.55, 0.3, 0.18 ) }; t = tc; hit = 3; }
			else if ( leaf ) { fcol = ${ srgb( 0.14, 0.24, 0.08 ) } * ( 0.8 + perlin2( c.xy * 14.0 ) * 0.3 ); t = tc; hit = 3; }
		}
		// the pendant lamp under the crown
		let lp = vec3f( 0.0, bi - 0.95, - D * 0.42 );
		let oc = ro - lp;
		let lb = dot( oc, rd ); let lc = dot( oc, oc ) - 0.2 * 0.2;
		let ld = lb * lb - lc * dot( rd, rd );
		if ( ld > 0.0 ) { let tl = ( - lb - sqrt( ld ) ) / dot( rd, rd ); if ( tl > 0.0 && tl < t ) { t = tl; hit = 4; } }
		let H = ro + rd * t;
		let back = sat( - H.z / D );
		var col = vec3f( 0.0 );
		if ( hit == 0 ) {
			let rib = smoothstep( 0.07, 0.0, abs( fract( H.z / 1.7 + h1 ) - 0.5 ) - 0.43 );
			col = mix( ${ srgb( 0.76, 0.6, 0.42 ) }, ${ srgb( 0.87, 0.74, 0.55 ) }, perlin2( H.xz * 0.8 + seed ) * 0.5 + 0.5 ) * ( 1.0 - rib * 0.2 );
		} else if ( hit == 1 ) {
			let plank = floor( H.x / 0.19 );
			let seam = smoothstep( 0.012, 0.0, abs( fract( H.x / 0.19 ) - 0.5 ) - 0.47 );
			col = mix( ${ srgb( 0.42, 0.27, 0.15 ) }, ${ srgb( 0.55, 0.37, 0.21 ) }, hash21( vec2f( plank, seed ) ) ) * ( 1.0 - seam * 0.4 );
			let rugIn = abs( H.x ) < ai * 0.48 && H.z < - D * 0.2 && H.z > - D * 0.7;
			let rugEdge = abs( H.x ) > ai * 0.42 || H.z > - D * 0.25 || H.z < - D * 0.65;
			let rug = mix( mix( ${ srgb( 0.5, 0.16, 0.1 ) }, ${ srgb( 0.18, 0.24, 0.42 ) }, step( 0.5, h1 ) ), ${ srgb( 0.78, 0.66, 0.42 ) }, select( 0.0, 1.0, rugEdge ) );
			col = select( col, rug, rugIn );
		} else if ( hit == 2 ) {
			col = ${ srgb( 0.72, 0.58, 0.41 ) };
			if ( h2 > 0.45 ) {
				// shelves of books and jars
				let shelf = abs( H.x ) < ai * 0.62 && H.y > 0.3 && H.y < 2.1;
				let row = floor( H.y / 0.42 );
				let board = fract( H.y / 0.42 ) < 0.08;
				let book = hash21( vec2f( floor( H.x / 0.07 ), row + seed ) );
				let bk = mix( mix( ${ srgb( 0.45, 0.12, 0.08 ) }, ${ srgb( 0.12, 0.2, 0.32 ) }, step( 0.4, book ) ), ${ srgb( 0.6, 0.5, 0.3 ) }, step( 0.75, book ) );
				let filled = fract( H.y / 0.42 ) < 0.08 + 0.75 * step( 0.15, book );
				if ( shelf ) { col = select( select( col * 0.5, bk, filled ), ${ srgb( 0.36, 0.24, 0.13 ) }, board ); }
			} else {
				// a doorway on to the next room
				let door = length( vec2f( H.x / 0.6, H.y / 2.1 ) ) < 1.0;
				col = select( col, col * 0.22, door );
			}
		} else if ( hit == 3 ) {
			col = fcol;
		}
		// light: from the window by day, falling off toward the back; the lamp's pool after dusk
		let lampPool = 1.0 / ( 1.0 + dot( H - lp, H - lp ) * 0.25 );
		// (sunlight through the glass warms the room by day)
		illum = mix( mix( 1.6, 0.8, back ) + lampPool * 0.5, 0.25 + lampPool * 1.6, night );
		col *= mix( ${ srgb( 1.0, 0.9, 0.76 ) }, vec3f( 1.0 ), night );
		inside = col;
		if ( hit == 4 ) { inside = ${ srgb( 1.0, 0.8, 0.5 ) }; illum = mix( 2.5, 5.0, night ); }
	}
	let frameK = 0.0;
	// (skylights: blue-grey glass over a dim room, seen mostly by the sky they reflect)
	let sky = d.z > 1.5 && d.z < 2.5;
	s.albedo = select( mix( inside * 0.05, ${ srgb( 0.36, 0.25, 0.16 ) }, frameK ), ${ srgb( 0.08, 0.12, 0.16 ) }, sky );
	s.roughness = mix( 0.03 + room * 0.03, 0.7, frameK );
	s.emissive = inside * illum * lit * select( mix( 1.6, 4.5, night ), mix( 1.1, 3.4, night ), traced ) * ( 1.0 - frameK );
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

// paper lanterns (the festival strings): coloured paper lit by the sun by day, glowing from within after dusk
// (tint: the paper's colour; vdata.x seed)
export function createLanternMaterial() {

	const m = standard( {
		name: 'SettlementLanterns', roughness: 0.75, metalness: 0,
		attributes: ATTRIBUTES, varyings: VARYINGS,
	} );
	m.modules = [ commonModule ];
	m.vertex = PASS;
	m.surface = /* wgsl */`
	let night = smoothstep( 0.1, 0.7, frame.night );
	// paper ribs round the lantern
	let rib = smoothstep( 0.02, 0.0, abs( fract( in.uv.y * 9.0 ) - 0.5 ) - 0.46 );
	let c = in.vs.vTint * ( 0.92 + perlin2( in.uv * 13.0 + in.vs.vData.x * 9.0 ) * 0.06 ) * ( 1.0 - rib * 0.25 );
	s.albedo = c;
	s.roughness = 0.75;
	s.translucency = c * 0.6;
	s.emissive = c * ( 0.12 + night * 3.2 ) * ( 1.0 - rib * 0.5 );
`;
	return m;

}

// the sky flowers' petals (SkyFlowers.js): smooth pale petal-white, faintly lilac toward the hub, with fine
// veins running out along them that glow the pale technology blue (breathing slowly; brighter at night). The
// sun shows through them a little. uv: u along the petal (0 hub .. 1 tip), v across (-1 .. 1).
export function createPetalMaterial() {

	const m = standard( {
		name: 'SkyFlowerPetals', roughness: 0.35, metalness: 0, side: 'double',
		attributes: ATTRIBUTES, varyings: VARYINGS,
	} );
	m.modules = [ commonModule ];
	m.vertex = PASS;
	m.surface = /* wgsl */`
	let u = in.uv.x;
	let v = in.uv.y;
	var c = mix( ${ srgb( 0.78, 0.72, 0.86 ) }, in.vs.vTint, smoothstep( 0.0, 0.45, u ) );
	// veins: the spine and a few running out to the edge
	let spine = 1.0 - smoothstep( 0.015, 0.04, abs( v ) );
	let side = 1.0 - smoothstep( 0.02, 0.05, abs( fract( v * 2.5 + u * 0.8 ) - 0.5 ) );
	let vein = max( spine, side * smoothstep( 0.15, 0.4, u ) * 0.7 ) * ( 1.0 - smoothstep( 0.85, 1.0, u ) );
	c = c * ( 1.0 - vein * 0.12 );
	let night = smoothstep( 0.1, 0.7, frame.night );
	let breathe = sin( frame.time * 0.7 + in.vs.vData.x * 6.28 ) * 0.25 + 0.75;
	s.albedo = c;
	s.roughness = 0.35;
	s.translucency = c * 0.35;
	s.emissive = vec3f( 0.42, 0.78, 1.0 ) * vein * breathe * mix( 0.15, 2.0, night );
`;
	return m;

}
