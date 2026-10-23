import { Color, Group, Mesh } from '../engine/index.js';
import { mulberry32 } from '../util/Noise.js';
import { Builder } from './village/GeoBuilder.js';
import { VillageTextures } from './village/TextureBaker.js';
import { createVillageMaterials } from './village/VillageMaterials.js';
import { Rand } from './Props.js';
import { PATHS as TERRAIN_PATHS } from './terrain/Paths.js';
import { Grading, frame, polygonDistance } from './settlement/Grading.js';
import { smoothstep } from '../util/Noise.js';
import { buildHome } from './settlement/Home.js';
import { buildFestival } from './settlement/Festival.js';
import { buildHomeGarden } from './settlement/HomeGarden.js';
import { buildSteps, buildPavedPath, buildPathLights, buildBridge, buildPergola, buildGarden, buildPlay, buildDock } from './settlement/Landscape.js';
import { waterMeshes } from './settlement/Water.js';
import { Drapes } from './settlement/Drapes.js';
import { createStoneMaterial, createGlazingMaterial, createGlowMaterial, createSailMaterial, createLanternMaterial } from './settlement/SettlementMaterials.js';
import { buildBoats } from './settlement/Boats.js';
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
		// the clearings are open ground (meadow, no forest floor), with a ragged edge into the woods
		for ( const poly of [ PLAN.CLEARING, PLAN.HAMLET_CLEARING ] ) {

			let x0 = Infinity, x1 = - Infinity, z0 = Infinity, z1 = - Infinity;
			for ( const [ x, z ] of poly ) {

				x0 = Math.min( x0, x ); x1 = Math.max( x1, x ); z0 = Math.min( z0, z ); z1 = Math.max( z1, z );

			}

			G.each( x0 - 20, z0 - 20, x1 + 20, z1 + 20, ( k, x, z ) => {

				if ( terrain.heights[ k ] < 0.2 ) return;
				const rag = terrain.noise.fbm( x / 23, z / 23, 3 ) * 9 + terrain.noise2.noise( x / 6, z / 6 ) * 2.5;
				const t = 1 - smoothstep( - 4, 4, polygonDistance( poly, x, z ) + rag );
				if ( t > 0 ) G.open( k, t );

			} );

		}


		G.smoothArea( PLAN.GREEN, { blur: 4, edge: 7 } );
		this.allPaths = [ ...PLAN.PATHS, ...PLAN.HAMLET_PATHS ];
		for ( const p of this.allPaths ) G.path( p );
		// the pond first: it settles its level under the natural rim, which the stream then runs through
		G.pond( PLAN.POND );
		this.stream = G.stream( PLAN.STREAM, PLAN.POND );
		this.homes = [ ...PLAN.HOMES, ...PLAN.HAMLET ].map( ( h ) => ( { h, g: G.home( h ) } ) );
		// the paths join the terrain's own list (worn ground, kept clear of plants and debris)
		for ( const p of this.allPaths ) TERRAIN_PATHS.push( p );
		terrain.buildMinMax();
		const t1 = performance.now();

		// ---------------------------------------------------------------- 2. the built village
		const ground = ( x, z ) => terrain.heightAt( x, z );
		const B = new Builder();
		const drapes = new Drapes();
		// plants the village sets (pots on the terraces): { x, z, y, s, kind: 'shrub' | 'fern' }, for Vegetation
		this.plantings = [];
		let shellTris = 0;
		for ( const { h, g } of this.homes ) {

			const r = buildHome( B, h, g, rand, ground, drapes, this.plantings );
			shellTris += r.shape.triangles;
			for ( const c of r.colliders ) colliders.addBox( c.center, c.half, c.yaw, { tag: 'home' } );
			for ( const l of r.lights ) this.lights.push( { position: l.position, color: l.kind === 'fire' ? new Color( 1.0, 0.5, 0.2 ) : new Color( 1.0, 0.66, 0.36 ), intensity: l.kind === 'window' ? 1.8 : 1.0, kind: l.kind === 'window' ? 'window' : 'lantern' } );
			if ( h.garden ) this.footprints.push( ...buildHomeGarden( B, h, g, ground, rand, drapes, this.plantings ) );
			const f = frame( h.x, h.z, h.yaw );
			const [ cx, cz ] = f.toW( 0, ( g.terrace - h.depth ) / 2 );
			const R = Math.hypot( h.len + 2, h.depth + g.terrace ) / 2 + 0.5;
			this.footprints.push( { x: cx, z: cz, r: R, kind: 'building' } );
			this.buildings.push( { name: h.name ?? h.id, x: cx, z: cz, floorY: g.floorY, roofTop: g.floorY + 4.8, footprint: { x: cx, z: cz, r: R } } );

		}

		// the festival ground on the green: oaks, lantern strings, long tables
		for ( const l of buildFestival( B, PLAN.FESTIVAL, ground, rand, this.plantings, this.footprints ) ) this.lights.push( l );

		let steps = 0;
		for ( const p of this.allPaths ) {

			if ( p.pave ) buildPavedPath( B, p, ground );
			steps += buildSteps( B, p, rand, ground );
			// lamps along the longer walks
			if ( p.pts.length > 3 ) for ( const position of buildPathLights( B, p, ground, rand ) ) this.lights.push( { position, color: new Color( 1.0, 0.7, 0.4 ), intensity: 1.6, kind: 'pathLight' } );

		}

		for ( const b of PLAN.BRIDGES ) {

			for ( const c of buildBridge( B, b, ground, rand ) ) colliders.addBox( c.center, c.half, c.yaw, { walkable: true, solid: false, tag: 'bridge' } );
			this.footprints.push( { x: b.x, z: b.z, r: b.len / 2 + 1, kind: 'bridge' } );

		}

		for ( const p of PLAN.PERGOLAS ) {

			buildPergola( B, p, ground, rand, drapes );
			this.footprints.push( { x: p.x, z: p.z, r: p.len / 2 + 1, kind: 'pergola' } );

		}

		// the orchard: apple trees in rows (the vegetation's broadleaf trees, small, as 'tree' plantings)
		{

			const O = PLAN.ORCHARD, c = Math.cos( O.yaw ), s = Math.sin( O.yaw );
			for ( let i = 0; i < O.cols; i ++ ) for ( let j = 0; j < O.rows; j ++ ) {

				const lx = ( i - ( O.cols - 1 ) / 2 ) * O.spacing + ( rand.next() - 0.5 ) * 0.6, lz = ( j - ( O.rows - 1 ) / 2 ) * O.spacing;
				const x = O.x + lx * c + lz * s, z = O.z - lx * s + lz * c;
				this.plantings.push( { x, z, y: ground( x, z ) - 0.1, s: 0.45 + rand.next() * 0.1, kind: 'tree' } );

			}

			this.footprints.push( { x: O.x, z: O.z, r: O.spacing * 2, kind: 'orchard' } );

		}

		this.beds = [];
		for ( const gd of PLAN.GARDENS ) {

			const beds = buildGarden( B, gd, ground, rand );
			this.beds.push( ...beds );
			// crops in rows: low leafy plants (the vegetation's small shrubs and ferns)
			for ( const b of beds ) {

				const c = Math.cos( b.yaw ), s = Math.sin( b.yaw );
				for ( let i = 0; i < 6; i ++ ) for ( let j = 0; j < 2; j ++ ) {

					const lx = ( i - 2.5 ) / 6 * ( b.l - 0.3 ), lz = ( j - 0.5 ) * ( b.w * 0.5 );
					this.plantings.push( { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c, y: b.y, s: 0.42 + rand.next() * 0.15, kind: rand.next() < 0.6 ? 'shrub' : 'fern', crop: true } );

				}

			}

			this.footprints.push( { x: gd.x, z: gd.z, r: Math.max( gd.rows * ( gd.bed[ 0 ] + 1.1 ), gd.cols * ( gd.bed[ 1 ] + 1.3 ) ) / 2 + 1, kind: 'garden' } );

		}

		for ( const p of PLAN.PLAY ) {

			if ( p.kind !== 'boulders' ) buildPlay( B, p, ground, rand );
			this.footprints.push( { x: p.x, z: p.z, r: 3.5, kind: 'play' } );

		}

		buildBoats( B, PLAN.BOATS, rand );
		// the pond: no plants in the water (its ellipse as three circles along the long axis, so the meadow
		// comes down to the water on the short sides)
		{

			const P = PLAN.POND, a = Math.max( P.rx, P.rz ), b = Math.min( P.rx, P.rz ), along = P.rx >= P.rz;
			const ux = along ? Math.cos( P.yaw ) : Math.sin( P.yaw ), uz = along ? - Math.sin( P.yaw ) : Math.cos( P.yaw );
			for ( const t of [ - 1, 0, 1 ] ) this.footprints.push( { x: P.x + ux * t * ( a - b ), z: P.z + uz * t * ( a - b ), r: b + 0.4, kind: 'pond' } );

		}
		for ( const c of buildDock( B, PLAN.DOCK, ground, rand ) ) colliders.addBox( c.center, c.half, c.yaw, { walkable: true, solid: false, tag: 'dock' } );
		this.footprints.push( { x: PLAN.DOCK.x, z: ( PLAN.DOCK.zStart + PLAN.DOCK.zEnd ) / 2, r: 5, kind: 'dock' } );
		// the erratics and the play boulders go to the rock scatter (Rocks: kind 'erratic'); rounded stones
		// edge the pond and line the stream, more of them at the falls
		terrain.rockSites.push( ...PLAN.ERRATICS.map( ( [ x, z, r ] ) => ( { x, z, r, h: r, kind: 'erratic' } ) ) );
		{

			const P = PLAN.POND, c = Math.cos( P.yaw ), s = Math.sin( P.yaw );
			for ( let k = 0; k < 34; k ++ ) {

				const a = k / 34 * Math.PI * 2 + rand.next() * 0.1;
				if ( Math.abs( Math.sin( a - 1.0 ) ) < 0.18 ) continue; // a gap: the path comes down to the water
				const lx = Math.cos( a ) * ( P.rx + 0.4 ), lz = Math.sin( a ) * ( P.rz + 0.4 );
				terrain.rockSites.push( { x: P.x + lx * c + lz * s, z: P.z - lx * s + lz * c, r: 0.35 + rand.next() * 0.5, kind: 'stone' } );

			}

			for ( let i = 0; i < this.stream.length; i += 6 ) {

				const q = this.stream[ i ];
				if ( q.water < 0.1 || ( q.seg >= P.inlet && q.seg < P.outlet ) ) continue;
				const n = q.fall ? 4 : rand.next() < 0.5 ? 1 : 0;
				for ( let k = 0; k < n; k ++ ) {

					const side = rand.next() < 0.5 ? - 1 : 1;
					const a = this.stream[ Math.min( this.stream.length - 1, i + 1 ) ];
					const dx = a.x - q.x, dz = a.z - q.z, l = Math.hypot( dx, dz ) || 1;
					const off = ( q.w * 0.5 + 0.2 + rand.next() * 0.5 ) * side;
					terrain.rockSites.push( { x: q.x - dz / l * off, z: q.z + dx / l * off, r: 0.3 + rand.next() * ( q.fall ? 0.7 : 0.4 ), kind: 'stone' } );

				}

			}

		}
		for ( const p of PLAN.PLAY ) if ( p.kind === 'boulders' ) terrain.rockSites.push( { x: p.x, z: p.z, r: p.r, h: p.r, kind: 'boulders' } );

		this._assemble( B );
		const dm = drapes.mesh();
		if ( dm ) this.group.add( dm );
		for ( const m of waterMeshes( this.stream, PLAN.POND, rand ) ) this.group.add( m );
		scene.add( this.group );
		this.timings = { grading: Math.round( t1 - t0 ), build: Math.round( performance.now() - t1 ), steps, shellTris, drapeVerts: drapes.batch.vcount, plantings: this.plantings.length };

	}

	_assemble( B ) {

		// timber and iron: the village's baked wood and hard materials; the rest the settlement's own
		this.textures = new VillageTextures();
		const village = createVillageMaterials( this.textures );
		const mats = {
			stone: createStoneMaterial(),
			glazing: createGlazingMaterial(),
			glow: createGlowMaterial(),
			sail: createSailMaterial(),
			lantern: createLanternMaterial(),
			fabric: village.fabric,
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
			mesh.castShadow = key === 'stone' || key === 'wood' || key === 'hard' || key === 'sail' || key === 'fabric';
			mesh.staticVelocity = true;
			if ( key === 'wood' || key === 'hard' || key === 'fabric' ) mesh.onBeforeRender = () => this.textures.bake();
			this.group.add( mesh );
			this.meshes.push( mesh );

		}

		this.triangles = B.triangles;

	}

	// corridors kept free of trees: [{ from: [x, z], to: [x, z], w }] (PLAN.VISTAS)
	get vistas() {

		return PLAN.VISTAS;

	}

	// the mown green's outline [[x, z], ...] (the terrain shades it as lawn)
	get lawnPolygon() {

		return PLAN.GREEN;

	}

	// 0..1: on the mown green (the plants' lawn)
	lawnAt( x, z ) {

		return 1 - smoothstep( - 3, 1.5, polygonDistance( PLAN.GREEN, x, z ) );

	}

	// the paths (and the stream), for the plants to keep clear of: [{ points, width }]
	get paths() {

		return [
			...this.allPaths.map( ( p ) => ( { points: p.pts, width: p.w * 2 } ) ),
			{ points: PLAN.STREAM.map( ( q ) => [ q.x, q.z ] ), width: 3.4 },
		];

	}

	getLightSources() {

		return this.lights;

	}

	getFootprints() {

		return this.footprints;

	}

	update() {}

}
