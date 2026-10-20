import { Mesh, Vector3 } from '../engine/index.js';
import { Texture } from '../engine/gpu/Texture.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { CDLOD } from '../core/CDLOD.js';
import { standard } from '../materials/Materials.js';
import { smoothstep } from '../util/Noise.js';
import { srgb, terrainShadingModule } from './terrain/TerrainShading.js';

// The land beyond the walkable area, to the horizon: the lake's far shores and islands, Rattlesnake and
// the Squam Range, Red Hill, the Sandwich Range foothills. A second CDLOD mesh over the mid (8 km, 4 m)
// and far (32 km, 16 m) grids that leaves out the near domain (the detailed Terrain covers it).
//
// The forest is a canopy shell: forested ground is raised by the height of the trees (~15 - 24 m, in
// stands), so ridges carry a tree line on the skyline and the shores a wall of trees at the water; it
// ramps down to the bare ground at the edge of the near domain, where the planted trees take over. The
// material draws the crowns (clumps, gaps, darker conifer stands among the hardwoods), granite on the
// steep ground and the hill shadows; the haze does the rest.
//
// Baked per grid (RGBA8, mipmapped): xz of the ground normal, canopy cover (land above the water, not
// too steep), rock (steep ground).
const CANOPY = 19; // m: mean canopy height
const NEAR_RAMP = 140; // m: the canopy shell grows to full height over this distance from the near domain

function bakeGrid( g, waterLevelAt ) {

	const { res, texel, origin, heights: H } = g;
	const out = new Uint8Array( res * res * 4 );
	const inv2t = 1 / ( 2 * texel );
	for ( let j = 0; j < res; j ++ ) {

		const jm = j > 0 ? j - 1 : 0, jp = j < res - 1 ? j + 1 : res - 1;
		const z = origin + ( j + 0.5 ) * texel;
		for ( let i = 0; i < res; i ++ ) {

			const im = i > 0 ? i - 1 : 0, ip = i < res - 1 ? i + 1 : res - 1;
			const k = j * res + i;
			const hx = ( H[ j * res + ip ] - H[ j * res + im ] ) * inv2t;
			const hz = ( H[ jp * res + i ] - H[ jm * res + i ] ) * inv2t;
			const il = 1 / Math.sqrt( hx * hx + 1 + hz * hz );
			const slope = Math.sqrt( hx * hx + hz * hz );
			const x = origin + ( i + 0.5 ) * texel;
			const above = H[ k ] - waterLevelAt( x, z );
			const canopy = smoothstep( 0.2, 1.5, above ) * ( 1 - smoothstep( 0.95, 1.5, slope ) );
			const rock = smoothstep( 0.75, 1.2, slope );
			const o = k * 4;
			out[ o ] = ( - hx * il * 0.5 + 0.5 ) * 255 + 0.5;
			out[ o + 1 ] = ( - hz * il * 0.5 + 0.5 ) * 255 + 0.5;
			out[ o + 2 ] = canopy * 255 + 0.5;
			out[ o + 3 ] = rock * 255 + 0.5;

		}

	}

	const tex = new Texture( { label: 'farTerrainMap', width: res, height: res, format: 'rgba8unorm', mips: true, usage: [ 'sample', 'copyDst' ], data: out } );
	tex.getGPU();
	generateMipmaps( tex );
	return tex;

}

export class FarTerrain {

	constructor( { scene, terrainData, terrainGPU } ) {

		const t0 = performance.now();
		this.data = terrainData;
		this.gpu = terrainGPU;
		const wl = ( x, z ) => terrainData.waterLevelAt( x, z );
		this.midMap = bakeGrid( terrainData.mid, wl );
		this.farMap = bakeGrid( terrainData.far, wl );
		const half = terrainData.far.size / 2;
		const nh = terrainData.size / 2;

		this.lod = new CDLOD( {
			gridSize: 32, leafSize: 64, levels: 10, rangeFactor: 3, maxInstances: 2400,
			heightBounds: ( x0, z0, x1, z1 ) => {

				const b = terrainData.boundsFor( x0, z0, x1, z1 );
				return [ b[ 0 ], b[ 1 ] + CANOPY + 6 ];

			},
			center: { x: - half, z: - half, size: terrainData.far.size },
			exclude: { x0: - nh, z0: - nh, x1: nh, z1: nh },
			prefix: 'farLod',
		} );

		this.module = new ShaderModule( {
			name: 'farTerrain',
			deps: [ terrainGPU.module ],
			bindings: { farMidMap: { texture: this.midMap }, farFarMap: { texture: this.farMap } },
			code: /* wgsl */`
// the baked map (ground normal xz, canopy cover, rock) of the finest grid at xz, explicit mip
fn farTerrainMapLevel( xz: vec2f, level: f32 ) -> vec4f {
	let midUv = xz / terrainParams.midSize + 0.5;
	if ( all( midUv > vec2f( 0.001 ) ) && all( midUv < vec2f( 0.999 ) ) ) {
		return textureSampleLevel( farMidMap, smpLinearClamp, midUv, level );
	}
	return textureSampleLevel( farFarMap, smpLinearClamp, xz / terrainParams.farSize + 0.5, max( level - 2.0, 0.0 ) );
}

// distance (m) outside the near domain
fn farTerrainOutside( xz: vec2f ) -> f32 {
	let d = abs( xz - ( terrainParams.origin + terrainParams.size * 0.5 ) ) - vec2f( terrainParams.size * 0.5 );
	return max( d.x, d.y );
}

// height of the canopy shell above the ground (stands of taller and lower trees)
fn farTerrainCanopy( xz: vec2f, cover: f32 ) -> f32 {
	let stands = textureSampleLevel( terrainDetailTex, smpLinearRepeat, xz / 690.0, 0.0 ).w;
	let crowns = textureSampleLevel( terrainDetailTex, smpLinearRepeat, xz / 97.0 + 0.31, 0.0 ).w;
	let h = ${ CANOPY.toFixed( 1 ) } * ( 0.78 + ( stands - 0.5 ) * 0.5 + ( crowns - 0.5 ) * 0.3 );
	return h * cover * smoothstep( 0.0, ${ NEAR_RAMP.toFixed( 1 ) }, farTerrainOutside( xz ) );
}
`,
		} );

		this.uViewPos = { value: new Vector3() };
		const mat = this.material = standard( {
			name: 'FarTerrain',
			roughness: 0.95, metalness: 0,
			uniforms: { viewPos: [ 'vec3f', this.uViewPos.value ] },
			attributes: { nodeData: 'vec4f' },
			varyings: { vCanopy: 'f32' },
		} );
		this.uViewPos = mat.uniforms.viewPos;
		mat.modules = [ terrainGPU.module, terrainShadingModule(), this.lod.module, this.module, terrainGPU.sunModulationModule ];
		mat.defines.MATERIAL_SUN_MODULATION = 1;
		mat.appliesHillShadow = true;
		mat.localLightsCheap = true;
		mat.vertex = /* wgsl */`
	let snapped = farLodSnapped( v.nodeData, v.position.xz );
	let y0 = terrainHeightAt( snapped );
	let cv = farLodMorph( v.nodeData, v.position.xz, mat.viewPos, y0 );
	let xz = cv.worldXZ;
	let m = farTerrainMapLevel( xz, max( log2( cv.spacing / 4.0 ), 0.0 ) );
	let canopy = farTerrainCanopy( xz, m.z );
	v.useWorld = true;
	v.worldPos = vec3f( xz.x, terrainHeightAt( xz ) + canopy, xz.y );
	v.worldNormal = vec3f( 0.0, 1.0, 0.0 );
	o.vCanopy = canopy;
`;
		mat.surface = /* wgsl */`
	let p = in.P;
	let xz = p.xz;
	// the near domain is drawn by the detailed terrain
	if ( farTerrainOutside( xz ) < 0.0 ) { discard; }
	let midUv = xz / terrainParams.midSize + 0.5;
	let a = textureSample( farMidMap, smpLinearClamp, midUv );
	let b = textureSample( farFarMap, smpLinearClamp, xz / terrainParams.farSize + 0.5 );
	let m = select( b, a, all( midUv > vec2f( 0.001 ) ) && all( midUv < vec2f( 0.999 ) ) );
	let nxz = m.xy * 2.0 - 1.0;
	let N0 = normalize( vec3f( nxz.x, sqrt( max( 1.0 - dot( nxz, nxz ), 0.01 ) ), nxz.y ) );
	let camDist = length( frame.cameraPos - p );
	let canopyW = sat( in.vs.vCanopy / 6.0 );
	let rockW = m.w * ( 1.0 - canopyW * 0.85 );

	// ---- the canopy: stands (darker conifers among the hardwoods), crowns and the gaps between them
	let stands = textureSample( terrainDetailTex, smpLinearRepeat, xz / 690.0 ).w;
	let patchA = textureSample( terrainDetailTex, smpLinearRepeat, xz / 211.0 + 0.47 ).w;
	let crowns = textureSample( terrainDetailTex, smpAniso4Repeat, xz / 23.0 + 0.13 ).w;
	let crownsB = textureSample( terrainDetailTex, smpAniso4Repeat, xz / 8.3 + 0.71 ).w;
	let conifer = smoothstep( 0.42, 0.62, stands * 0.65 + patchA * 0.35 );
	var canopy = mix( ${ srgb( 0.2, 0.29, 0.1 ) }, ${ srgb( 0.27, 0.34, 0.13 ) }, smoothstep( 0.35, 0.7, patchA ) );
	canopy = mix( canopy, ${ srgb( 0.1, 0.16, 0.08 ) }, conifer );
	let lit = smoothstep( 0.3, 0.75, crowns * 0.6 + crownsB * 0.4 );
	let crownK = 1.0 - smoothstep( 1500.0, 5000.0, camDist ) * 0.6;
	canopy = canopy * mix( 1.0, lit * 0.75 + 0.45, crownK );
	// birch and maple crowns paler here and there
	canopy = mix( canopy, ${ srgb( 0.32, 0.38, 0.17 ) }, smoothstep( 0.72, 0.85, crownsB + patchA * 0.2 ) * ( 1.0 - conifer ) * 0.5 );

	// ---- ground: granite ledges (pale, lichened), forest floor under thin cover, the shore
	let rockTone = mix( ${ srgb( 0.33, 0.32, 0.3 ) }, ${ srgb( 0.5, 0.49, 0.46 ) }, smoothstep( 0.3, 0.7, crownsB ) );
	let ground = mix( ${ srgb( 0.2, 0.2, 0.12 ) }, ${ srgb( 0.26, 0.23, 0.16 ) }, crowns );
	let shore = smoothstep( 1.2, 0.2, p.y - max( terrainWaterLevelAt( xz ), 0.0 ) );
	var albedo = mix( ground, rockTone, rockW );
	albedo = mix( albedo, ${ srgb( 0.36, 0.33, 0.27 ) }, shore * ( 1.0 - canopyW ) );
	albedo = mix( albedo, canopy, canopyW * ( 1.0 - rockW ) );

	// crown relief for the normal: lumpy crowns up close, the stands' texture farther out
	let hd = ( crowns * 2.4 + crownsB * 0.9 ) * canopyW + crownsB * 0.3 * rockW;
	s.normal = terrainPerturbNormal( p, N0, hd, 1.0 );
	s.albedo = albedo;
	s.roughness = mix( 0.95, 0.8, rockW );
	s.ao = mix( 1.0, lit * 0.45 + 0.55, canopyW * crownK );
`;
		mat.needsUpdate = true;

		this.mesh = new Mesh( this.lod.geometry, mat );
		this.mesh.frustumCulled = false;
		this.mesh.receiveShadow = true;
		this.mesh.castShadow = false;
		this.mesh.staticVelocity = true;
		this.mesh.name = 'FarTerrain';
		scene.add( this.mesh );
		this.timings = { bake: Math.round( performance.now() - t0 ) };

	}

	update( camera ) {

		camera.getWorldPosition( this.uViewPos.value );
		this.lod.update( camera );

	}

}
