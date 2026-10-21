import * as THREE from '../engine/index.js';
import { G } from '../core/Globals.js';
import { VegSite, RULES } from './vegetation/Scatter.js';
import { scatterForest, buildMeadowMask } from './vegetation/ForestScatter.js';
import { VegType, LodLevel } from './vegetation/InstanceLOD.js';
import { GrassField } from './vegetation/GrassField.js';
import { uCamPos, uGustOffset } from './vegetation/VegNodes.js';

// WGSL variant index of an instance (VegNodes.vegVariantOf)
const variantOf = ( seed, isShrub ) => `vegVariantOf( ${ seed }, ${ isShrub } )`;
import {
	buildCanopyNear, buildTreeNear, buildShrubNear, buildFern, lobeVariantGeometry, LOBE_TABLE, TREE_VARIANTS, SHRUB_VARIANTS, UNDERSTORY,
} from './vegetation/PlantGeometry.js';
import { GeoBuilder } from './vegetation/GeoBuilder.js';
import { buildPineNear, buildHemlockNear, coniferVariantGeometry, CONIFER_VARIANTS } from './vegetation/ConiferGeometry.js';
import { NeedleAtlas, createConiferMaterial, createConiferBakeMaterials, CONIFER_NEAR } from './vegetation/ConiferMaterials.js';
import { createPlantLeafMaterial, createCanopyMaterial, createCanopyBakeMaterials, impostorColor, uCanopyNear } from './vegetation/VegMaterials.js';
import { coniferModule } from './vegetation/ConiferMaterials.js';
import { ImpostorAtlas, buildImpostorQuad } from './vegetation/Impostors.js';
import { LeafAtlas } from './vegetation/LeafTextures.js';

// The woods and the village planting (placement: vegetation/ForestScatter.js): eastern white pines and
// hemlocks (vegetation/Conifer*.js), the hardwoods (maple, red oak, beech and paper birch: the broadleaf
// canopy trees) with their shrubs (mountain laurel, hobblebush, blueberry), ferns on the forest floor, and a
// camera-following field of meadow grass, lawn and wildflowers on the open ground.
//
// Everything is instanced and procedural. Wind (G.windDir / G.windSpeed) drives trunk sway, branch
// bending, leaf flutter and travelling gusts across the grass.
//
// Draw calls (main pass): ferns, canopy near (trees + shrubs), canopy impostors, pines near, hemlocks near,
// conifer impostors (pines, hemlocks), grass near / mid / far. Shadow casters: the near trees.
//
// Options: { scene, terrain, village? } - with a village (Settlement.js) its footprints are kept clear and
// its green is lawn. The impostor atlases are baked on the first update() (recorded into the frame
// encoder); until then far trees are not drawn.

// Building footprints + boardwalk polylines from a Village instance (duck-typed).
function villageObstacles( village ) {

	if ( ! village ) return {};
	const footprints = typeof village.getFootprints === 'function' ? village.getFootprints() : [];
	if ( Array.isArray( village.paths ) ) return { footprints, paths: village.paths };
	const paths = [];
	for ( const p of [ village.path, ...( village.sidePaths || [] ) ] ) {

		if ( ! p || ! p.samples ) continue;
		const pts = [];
		for ( let i = 0; i < p.samples.length; i += 5 ) pts.push( [ p.samples[ i ].p.x, p.samples[ i ].p.z ] );
		const last = p.samples[ p.samples.length - 1 ];
		pts.push( [ last.p.x, last.p.z ] );
		paths.push( { points: pts, width: p.width ?? 1.8 } );

	}

	return { footprints, paths: paths.length ? paths : null };

}

// bounding sphere of a geometry around its vertical axis (impostor frames are centred on it)
function axisSphere( geometry ) {

	const p = geometry.attributes.position;
	const v = new THREE.Vector3();
	let y0 = Infinity, y1 = - Infinity;
	for ( let i = 0; i < p.count; i ++ ) {

		v.fromBufferAttribute( p, i );
		y0 = Math.min( y0, v.y );
		y1 = Math.max( y1, v.y );

	}

	const center = new THREE.Vector3( 0, ( y0 + y1 ) * 0.5, 0 );
	let r = 0, rh = 0;
	for ( let i = 0; i < p.count; i ++ ) {

		v.fromBufferAttribute( p, i );
		r = Math.max( r, v.distanceTo( center ) );
		rh = Math.max( rh, Math.hypot( v.x, v.z ) );

	}

	// radius: frame size of the atlas; rh / hv: horizontal radius and half height (quad extents)
	return { center, radius: r * 1.02, rh: rh * 1.03, hv: ( y1 - y0 ) * 0.5 * 1.03 };

}

const TREE_NEAR = 65; // m, broadleaf trees: geometry -> impostor
const SHRUB_NEAR = 45;
const FERN_FADE = [ 42, 58 ];
const CANOPY_FAR = [ 2600, 2800 ];

export class Vegetation {

	constructor( { scene, terrain, village = null } ) {

		this.scene = scene;
		this.terrain = terrain;
		this.group = new THREE.Group();
		this.group.name = 'Vegetation';
		this.group.matrixAutoUpdate = false;

		const t0 = performance.now();
		const site = new VegSite( terrain, villageObstacles( village ) );
		// the village green is mown lawn
		if ( village && village.lawnAt ) site.inLawn = ( x, z ) => village.lawnAt( x, z );
		if ( village && village.plantings ) site.plantings = village.plantings;
		this.site = site;
		const recs = scatterForest( site );
		this.records = recs;
		const t1 = performance.now();
		const grassMask = buildMeadowMask( site );
		this.timings = { scatter: t1 - t0, mask: performance.now() - t1 };

		// materials (shared across meshes)
		const leafMat = createPlantLeafMaterial();
		this.leafAtlas = new LeafAtlas();
		const canopyMat = createCanopyMaterial( this.leafAtlas );
		uCanopyNear.value.set( TREE_NEAR, SHRUB_NEAR );
		this.needleAtlas = new NeedleAtlas();
		const coniferMat = createConiferMaterial( this.needleAtlas );

		// geometry
		const fernB = new GeoBuilder();
		fernB.kind = UNDERSTORY.FERN;
		buildFern( 3, fernB );
		const fernGeo = fernB.build( 4, new THREE.Vector3( 0, 0.6, 0 ) );
		const canopy = buildCanopyNear();
		const pine = buildPineNear(), hemlock = buildHemlockNear();

		// impostor atlas of the tree and shrub crown variants (same lobe tables as the near mesh)
		const treeGeo = buildTreeNear().geometry, shrubGeo = buildShrubNear().geometry;
		const treeVariants = [], shrubVariants = [];
		for ( let v = 0; v < TREE_VARIANTS; v ++ ) treeVariants.push( lobeVariantGeometry( treeGeo, LOBE_TABLE, v * 8 ) );
		for ( let v = 0; v < SHRUB_VARIANTS; v ++ ) shrubVariants.push( lobeVariantGeometry( shrubGeo, LOBE_TABLE, ( TREE_VARIANTS + v ) * 8 ) );
		this.atlas = new ImpostorAtlas( [
			{ variants: treeVariants, ...axisSphere( treeGeo ) },
			{ variants: shrubVariants, ...axisSphere( shrubGeo ) },
		], createCanopyBakeMaterials( this.leafAtlas ) );
		// (WGSL expressions: see ImpostorAtlas.createMaterial)
		const impostorMat = this.atlas.createMaterial( {
			isGroup1: ( iDat ) => `${ iDat }.y < 0.0`,
			variantOf: ( seed, isShrub ) => variantOf( seed, isShrub ),
			colorOf: ( { seed, cr, leaf, bright, isGroup1 } ) => `${ impostorColor }( ${ seed }, ${ cr }, ${ leaf }, ${ bright }, ${ isGroup1 } )`,
			nearDist: ( isShrub ) => `select( vegParams.canopyNear.x, vegParams.canopyNear.y, ${ isShrub } )`,
		} );
		// conifer impostors: group 0 pines, group 1 hemlocks (negative vertical scale), whorl variants
		const pineVariants = [], hemVariants = [];
		for ( let v = 0; v < CONIFER_VARIANTS; v ++ ) {

			pineVariants.push( coniferVariantGeometry( pine.geometry, v ) );
			hemVariants.push( coniferVariantGeometry( hemlock.geometry, v ) );

		}

		this.coniferAtlas = new ImpostorAtlas( [
			{ variants: pineVariants, ...axisSphere( pine.geometry ) },
			{ variants: hemVariants, ...axisSphere( hemlock.geometry ) },
		], createConiferBakeMaterials( this.needleAtlas ) );
		const coniferImpMat = this.coniferAtlas.createMaterial( {
			isGroup1: ( iDat ) => `${ iDat }.y < 0.0`,
			variantOf: ( seed ) => `conVariantOf( ${ seed } )`,
			colorOf: ( { seed, cr, leaf, bright, isGroup1 } ) => `conImpostorColor( ${ seed }, ${ cr }, ${ leaf }, ${ bright }, ${ isGroup1 } )`,
			nearDist: ( isHem ) => `select( ${ CONIFER_NEAR[ 0 ].toFixed( 1 ) }, ${ CONIFER_NEAR[ 1 ].toFixed( 1 ) }, ${ isHem } )`,
			group1Max: 1e6,
			modules: [ coniferModule ],
		} );
		this.materials = [ leafMat, canopyMat, impostorMat, coniferMat, coniferImpMat ];

		this.types = [];
		const add = ( t ) => {

			this.types.push( t );
			for ( const m of t.meshes ) this.group.add( m );
			return t;

		};

		// ferns on the forest floor (the plant leaf material keeps the fern kind: its seed's integer part)
		const fernRecs = recs.ferns.map( ( r ) => ( { ...r, seed: UNDERSTORY.FERN + r.seed * 0.999, qr: FERN_FADE[ 1 ] + 8 } ) );
		this.understory = add( new VegType( 'ferns', fernRecs, {
			fade: FERN_FADE, margin: 10, sortNear: true,
			near: [ { geometry: fernGeo, material: leafMat, castShadow: false, name: 'veg-ferns' } ],
		} ) );

		// canopy: broadleaf trees + shrubs (shrubs flagged by a negative vertical scale in iDat.y); near
		// geometry within TREE_NEAR / SHRUB_NEAR, octahedral impostors beyond
		const canopyRecs = [
			...recs.trees.map( ( r ) => ( { ...r, qr: TREE_NEAR + 10 } ) ),
			...recs.shrubs.map( ( r ) => ( { ...r, qr: SHRUB_NEAR + 10 } ) ),
		];
		this.canopy = add( new VegType( 'canopy', canopyRecs, {
			nearRange: TREE_NEAR, margin: 10, sortNear: true, sortFar: true, farRefresh: 16,
			near: [ { geometry: canopy.geometry, material: canopyMat, castShadow: true, name: 'veg-canopy' } ],
			far: { parts: [ { geometry: buildImpostorQuad(), material: impostorMat, name: 'veg-canopy-far' } ], fade: CANOPY_FAR },
		} ) );

		// conifers: their own near meshes, one impostor material for both
		this.pines = add( new VegType( 'pines', recs.pines.map( ( r ) => ( { ...r, qr: CONIFER_NEAR[ 0 ] + 10 } ) ), {
			nearRange: CONIFER_NEAR[ 0 ], margin: 10, sortNear: true, sortFar: true, farRefresh: 16,
			near: [ { geometry: pine.geometry, material: coniferMat, castShadow: true, name: 'veg-pines' } ],
			far: { parts: [ { geometry: buildImpostorQuad(), material: coniferImpMat, name: 'veg-pines-far' } ], fade: CANOPY_FAR },
		} ) );
		this.hemlocks = add( new VegType( 'hemlocks', recs.hemlocks.map( ( r ) => ( { ...r, qr: CONIFER_NEAR[ 1 ] + 10 } ) ), {
			nearRange: CONIFER_NEAR[ 1 ], margin: 10, sortNear: true, sortFar: true, farRefresh: 16,
			near: [ { geometry: hemlock.geometry, material: coniferMat, castShadow: true, name: 'veg-hemlocks' } ],
			far: { parts: [ { geometry: buildImpostorQuad(), material: coniferImpMat, name: 'veg-hemlocks-far' } ], fade: CANOPY_FAR },
		} ) );

		// alpha-tested foliage after the opaque ground (terrain, rocks, buildings) and the far crowns
		// after the near ones, so the early depth test rejects what those already cover
		for ( const t of this.types ) for ( const m of t.meshes ) m.renderOrder = 1;
		for ( const t of [ this.canopy, this.pines, this.hemlocks ] ) for ( const m of t.far.meshes ) m.renderOrder = 2;

		// the impostor bakes record into the frame encoder on the first update
		this.renderer = true;

		this.grass = new GrassField( { terrain, mask: grassMask } );
		for ( const m of this.grass.meshes ) this.group.add( m );

		this.geometryTriangles = {
			canopy: canopy.triangles, tree: canopy.treeTriangles, shrub: canopy.shrubTriangles, pine: pine.triangles, hemlock: hemlock.triangles, impostor: 2,
			grassNearPatch: this.grass.patchTris[ 0 ], grassMidPatch: this.grass.patchTris[ 1 ], grassFarPatch: this.grass.patchTris[ 2 ],
		};

		this.group.updateMatrixWorld( true );
		scene.add( this.group );

		this._camPos = new THREE.Vector3();
		this.timings.total = performance.now() - t0;

	}

	update( dt, camera ) {

		if ( this.renderer && ! this.atlas.baked ) {

			const t = performance.now();
			this.leafAtlas.bake( this.renderer );
			this.atlas.bake( this.renderer );
			this.needleAtlas.bake();
			this.coniferAtlas.bake( this.renderer );
			this.timings.bake = performance.now() - t;

		}

		camera.updateMatrixWorld();
		const p = camera.getWorldPosition( this._camPos );
		uCamPos.value.copy( p );

		// travelling gust field offset (integrated so speed/direction changes never jump)
		const wd = G.windDir.value;
		const speed = 0.7 * G.windSpeed.value + 1.5;
		uGustOffset.value.x += wd.x * speed * dt;
		uGustOffset.value.y += wd.y * speed * dt;

		// near-level refills happen only after the camera moved a few metres; at most two
		// types per frame (most overdue first) so fast flights never stack up refills.
		// Teleports (anything far past the margin) refill everything at once.
		let a = null, b = null, da = 0, db = 0;
		for ( const t of this.types ) {

			const d = t.overdue( p );
			if ( d > t.margin - t.refreshDistance ) t.update( p, true );
			else if ( d > da ) {

				b = a; db = da; a = t; da = d;

			} else if ( d > db ) {

				b = t; db = d;

			}

		}

		if ( a ) a.update( p, true );
		if ( b ) b.update( p, true );

		this.grass.update( camera );

	}

	// Re-upload the terrain height texture used by the grass after terrain.flatten() & co.
	// (plant placement is computed once in the constructor: build Vegetation after terrain edits).
	refreshTerrain() {

		this.grass.heightTex.needsUpdate = true;

	}

	stats() {

		const types = {};
		let tris = 0, draws = 0;
		for ( const t of this.types ) {

			const lv = {};
			for ( const [ name, l ] of [ [ 'near', t.near ], [ 'far', t.far ] ] ) {

				if ( ! l ) continue;
				lv[ name ] = { instances: l.count, triangles: l.triangles, meshes: l.meshes.length };
				tris += l.triangles;
				if ( l.count > 0 ) draws += l.meshes.length;

			}

			types[ t.name ] = { total: t.inst.count, ...lv };

		}

		const g = this.grass;
		types.grass = { nearCells: g.levels[ 0 ].count, midCells: g.levels[ 1 ].count, farCells: g.levels[ 2 ].count, triangles: g.triangles };
		tris += g.triangles;
		draws += g.levels.filter( ( l ) => l.count > 0 ).length;
		return { types, triangles: tris, drawCalls: draws, rules: RULES };

	}

	dispose() {

		this.scene.remove( this.group );
		for ( const t of this.types ) for ( const m of t.meshes ) m.geometry.dispose();
		for ( const m of this.materials ) m.dispose();
		for ( const a of [ this.atlas, this.coniferAtlas ] ) {

			a.rtA.dispose();
			a.rtB.dispose();
			a.depth.destroy();

		}

		this.leafAtlas.rt.dispose();
		this.needleAtlas.texture.destroy();
		this.grass.dispose();

	}

}

export { LodLevel };
