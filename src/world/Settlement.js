import { Color, Group, Mesh } from '../engine/index.js';
import { mulberry32 } from '../util/Noise.js';
import { Builder } from './village/GeoBuilder.js';
import { VillageTextures } from './village/TextureBaker.js';
import { createVillageMaterials } from './village/VillageMaterials.js';
import { Rand } from './Props.js';
import { PATHS as TERRAIN_PATHS } from './terrain/Paths.js';
import { Grading, frame, polygonDistance } from './settlement/Grading.js';
import { smoothstep } from '../util/Noise.js';
import { buildEarthHome } from './settlement/EarthHome.js';
import { buildTower } from './settlement/Towers.js';
import { buildSteps, buildPavedPath, buildApron, buildBridge, buildPergola, buildGarden, buildPlay, buildDock } from './settlement/Landscape.js';
import { waterMeshes } from './settlement/Water.js';
import { createStoneMaterial, createGlazingMaterial, createGlowMaterial } from './settlement/SettlementMaterials.js';
import * as PLAN from './settlement/Plan.js';

// The village of earth homes on the north shore of the cove (see settlement/Plan.js for the layout and
// docs/REFERENCE.md for the look). Built in two stages:
//   1. earthworks on the near heightmap (before the terrain mesh, its GPU maps and the plants read it):
//      the green and the plaza smoothed, paths levelled, the stream and the pond dug, terraces and roof
//      mounds for the homes, pads for the communal buildings (settlement/Grading.js)
//   2. the built things on the finished ground, merged per material (sandstone, glazing, timber, iron,
//      the blue light seams), the stream and the pond, colliders and light sources.
//
// The interface the rest of the world uses is the old Village's: group, lights (getLightSources),
// footprints (getFootprints: keep-out circles for plants and rocks), buildings, update().
export class Settlement {

	constructor( { scene, terrain, colliders } ) {

		const t0 = performance.now();
		this.terrain = terrain;
		this.colliders = colliders;
		this.group = new Group();
		this.group.name = 'Settlement';
		this.lights = [];
		this.footprints = [];
		this.buildings = [];
		this.foundationChecks = [];
		this.plan = PLAN;
		const rand = this.rand = new Rand( mulberry32( 20261020 ) );

		// ---------------------------------------------------------------- 1. earthworks
		const G = this.grading = new Grading( terrain );
		// the clearing is open ground (meadow, no forest floor), with a ragged edge into the woods
		{

			let x0 = Infinity, x1 = - Infinity, z0 = Infinity, z1 = - Infinity;
			for ( const [ x, z ] of PLAN.CLEARING ) {

				x0 = Math.min( x0, x ); x1 = Math.max( x1, x ); z0 = Math.min( z0, z ); z1 = Math.max( z1, z );

			}

			G.each( x0 - 20, z0 - 20, x1 + 20, z1 + 20, ( k, x, z ) => {

				if ( terrain.heights[ k ] < 0.2 ) return;
				const rag = terrain.noise.fbm( x / 23, z / 23, 3 ) * 9 + terrain.noise2.noise( x / 6, z / 6 ) * 2.5;
				const t = 1 - smoothstep( - 4, 4, polygonDistance( PLAN.CLEARING, x, z ) + rag );
				if ( t > 0 ) G.open( k, t );

			} );

		}


		G.smoothArea( PLAN.GREEN, { blur: 4, edge: 7 } );
		G.smoothArea( PLAN.PLAZA, { blur: 4, flat: 0.75, edge: 6 } );
		for ( const p of PLAN.PATHS ) G.path( p );
		this.stream = G.stream( PLAN.STREAM, PLAN.POND );
		G.pond( PLAN.POND );
		const towerY = PLAN.TOWERS.map( ( t ) => {

			const y = terrain.heightAt( t.x, t.z );
			G.pad( t.x, t.z, t.r + 1.5, y, 5 );
			return y;

		} );
		this.homes = PLAN.HOMES.map( ( h ) => ( { h, g: G.home( { ...h, terrace: h.terrace * 0.82 } ) } ) );
		this.annexes = PLAN.ANNEXES.map( ( h ) => ( { h: { ...h, terrace: 3, skylights: 0 }, g: G.home( { ...h, terrace: 3 } ) } ) );
		// the paths join the terrain's own list (worn ground, kept clear of plants and debris)
		for ( const p of PLAN.PATHS ) TERRAIN_PATHS.push( p );
		terrain.buildMinMax();
		const t1 = performance.now();

		// ---------------------------------------------------------------- 2. the built village
		const ground = ( x, z ) => terrain.heightAt( x, z );
		const B = new Builder();
		for ( const { h, g } of [ ...this.homes, ...this.annexes ] ) {

			const r = buildEarthHome( B, h, g, rand, ground );
			const c = r.collider;
			colliders.addBox( c.center, c.half, c.yaw, { tag: 'home' } );
			for ( const l of r.lights ) this.lights.push( { position: l.position, color: new Color( 1.0, 0.66, 0.36 ), intensity: 1.8, kind: l.kind } );
			const f = frame( h.x, h.z, h.yaw );
			const [ cx, cz ] = f.toW( ( g.xl + g.xr ) / 2, ( g.terrace - h.depth ) / 2 );
			const R = Math.hypot( g.xr - g.xl, h.depth + g.terrace ) / 2 + 1;
			this.footprints.push( { x: cx, z: cz, r: R, kind: 'building' } );
			this.buildings.push( { name: h.id, x: cx, z: cz, floorY: g.floorY, roofTop: g.floorY + h.rise + 1.2, footprint: { x: cx, z: cz, r: R } } );

		}

		PLAN.TOWERS.forEach( ( t, i ) => {

			const r = buildTower( B, t, towerY[ i ] - 0.05, rand );
			colliders.addBox( r.collider.center, r.collider.half, r.collider.yaw, { tag: 'tower' } );
			for ( const l of r.lights ) this.lights.push( { position: l.position, color: new Color( 1.0, 0.66, 0.36 ), intensity: 3, kind: 'window' } );
			this.footprints.push( { x: t.x, z: t.z, r: t.r + 2, kind: 'building' } );
			this.buildings.push( { name: t.id, x: t.x, z: t.z, floorY: towerY[ i ], roofTop: towerY[ i ] + t.h, footprint: { x: t.x, z: t.z, r: t.r + 1 } } );

		} );

		// aprons of flags round the communal buildings (each a little higher than the last where they overlap)
		PLAN.TOWERS.forEach( ( t, i ) => buildApron( B, t, ground, 0.06 + i * 0.012 ) );
		for ( const t of PLAN.TOWERS ) this.footprints.push( { x: t.x, z: t.z, r: t.r + 5, kind: 'plaza' } );
		let steps = 0;
		for ( const p of PLAN.PATHS ) {

			if ( p.pave ) buildPavedPath( B, p, ground );
			steps += buildSteps( B, p, rand );

		}

		for ( const b of PLAN.BRIDGES ) {

			for ( const c of buildBridge( B, b, ground, rand ) ) colliders.addBox( c.center, c.half, c.yaw, { walkable: true, solid: false, tag: 'bridge' } );
			this.footprints.push( { x: b.x, z: b.z, r: b.len / 2 + 1, kind: 'bridge' } );

		}

		for ( const p of PLAN.PERGOLAS ) {

			buildPergola( B, p, ground, rand );
			this.footprints.push( { x: p.x, z: p.z, r: p.len / 2 + 1, kind: 'pergola' } );

		}

		this.beds = [];
		for ( const gd of PLAN.GARDENS ) {

			this.beds.push( ...buildGarden( B, gd, ground, rand ) );
			this.footprints.push( { x: gd.x, z: gd.z, r: Math.max( gd.rows * ( gd.bed[ 0 ] + 1.1 ), gd.cols * ( gd.bed[ 1 ] + 1.3 ) ) / 2 + 1, kind: 'garden' } );

		}

		for ( const p of PLAN.PLAY ) {

			if ( p.kind !== 'boulders' ) buildPlay( B, p, ground, rand );
			this.footprints.push( { x: p.x, z: p.z, r: 3.5, kind: 'play' } );

		}

		for ( const c of buildDock( B, PLAN.DOCK, ground, rand ) ) colliders.addBox( c.center, c.half, c.yaw, { walkable: true, solid: false, tag: 'dock' } );
		this.footprints.push( { x: PLAN.DOCK.x, z: ( PLAN.DOCK.zStart + PLAN.DOCK.zEnd ) / 2, r: 5, kind: 'dock' } );
		// the erratics and the play boulders go to the rock scatter (Rocks: kind 'erratic')
		terrain.rockSites.push( ...PLAN.ERRATICS.map( ( [ x, z, r ] ) => ( { x, z, r, h: r, kind: 'erratic' } ) ) );
		for ( const p of PLAN.PLAY ) if ( p.kind === 'boulders' ) terrain.rockSites.push( { x: p.x, z: p.z, r: p.r, h: p.r, kind: 'boulders' } );

		this._assemble( B );
		for ( const m of waterMeshes( this.stream, PLAN.POND, rand ) ) this.group.add( m );
		scene.add( this.group );
		this.timings = { grading: Math.round( t1 - t0 ), build: Math.round( performance.now() - t1 ), steps };

	}

	_assemble( B ) {

		// timber and iron: the village's baked wood and hard materials; the rest the settlement's own
		this.textures = new VillageTextures();
		const village = createVillageMaterials( this.textures );
		const mats = {
			stone: createStoneMaterial(),
			glazing: createGlazingMaterial(),
			glow: createGlowMaterial(),
			wood: village.wood,
			hard: village.hard,
		};
		this.materials = mats;
		this.meshes = [];
		for ( const key in B.batches ) {

			const b = B.batches[ key ];
			if ( ! b.vcount || ! mats[ key ] ) continue;
			const mesh = new Mesh( b.build(), mats[ key ] );
			mesh.name = 'village_' + key;
			mesh.receiveShadow = key !== 'glow';
			mesh.castShadow = key === 'stone' || key === 'wood' || key === 'hard';
			mesh.staticVelocity = true;
			if ( key === 'wood' || key === 'hard' ) mesh.onBeforeRender = () => this.textures.bake();
			this.group.add( mesh );
			this.meshes.push( mesh );

		}

		this.triangles = B.triangles;

	}

	// 0..1: on the mown green (the plants' lawn)
	lawnAt( x, z ) {

		return 1 - smoothstep( - 3, 1.5, polygonDistance( PLAN.GREEN, x, z ) );

	}

	// the paths, for the plants to keep clear of: [{ points, width }]
	get paths() {

		return PLAN.PATHS.map( ( p ) => ( { points: p.pts, width: p.w * 2 } ) );

	}

	getLightSources() {

		return this.lights;

	}

	getFootprints() {

		return this.footprints;

	}

	update() {}

}
