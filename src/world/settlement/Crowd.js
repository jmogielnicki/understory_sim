import { Group } from '../../engine/index.js';
import { SkinnedModel } from '../../engine/render/Skinning.js';
import { loadGLB } from '../../engine/loaders/GLTF.js';

// People in the village (reference/neighborhood-v2.png: a crowd gathered on the festival green). Tidewater's
// two Rocketbox characters (public/models/characters, MIT), copied: they stand in small circles and talk,
// one speaking at a time while the others listen, look round or shrug; a few stand on the terraces of the
// homes and wave when you come up. They don't walk or sit (the models carry no such clips).
//
// Copies of a character share its textures and geometry (SkinnedModel caches them on the loaded file);
// each has its own skeleton. Animated only within ANIMATE metres of the camera (the pose holds beyond),
// hidden beyond SHOW.
//
//   const crowd = new Crowd( spots, rand );   // spots: [{ x, y, z, yaw, group }]; group: index of its circle
//   parent.add( crowd.group ); await crowd.ready; crowd.update( dt, camera )

const BASE = ( ( import.meta.env && import.meta.env.BASE_URL ) || '/' ) + 'models/characters/';
const CHARACTERS = [ 'joe', 'marta' ];
const TALK = [ 'gestic_talk_neutral_01', 'gestic_talk_relaxed_01' ];
const LISTEN = [ 'idle_neutral_01', 'idle_breathe_01', 'idle_look_around_01' ];
const ANIMATE = 70;
const SHOW = 320;

export class Crowd {

	constructor( spots, rand ) {

		this.group = new Group();
		this.group.name = 'Crowd';
		this.people = [];
		this.circles = new Map(); // group index -> { members, speaker, t }
		this.rand = rand;
		this.ready = this._load( spots ).catch( ( e ) => console.warn( 'Crowd: characters failed to load', e ) );

	}

	async _load( spots ) {

		const files = await Promise.all( CHARACTERS.map( ( c ) => loadGLB( BASE + c + '.glb' ) ) );
		const R = this.rand;
		for ( const s of spots ) {

			const gltf = files[ s.who ?? Math.floor( R.next() * files.length ) ];
			const model = await SkinnedModel.create( gltf );
			// on land, never under water: no caustics / wave lookups in their shaders
			for ( const m of model.materials ) m.underwaterLighting = 'lite';
			const g = model.group;
			g.position.set( s.x, s.y, s.z );
			g.rotation.y = s.yaw;
			const k = 0.95 + R.next() * 0.09;
			g.scale.set( k, k, k );
			const idle = LISTEN[ Math.floor( R.next() * LISTEN.length ) ];
			model.play( idle, { fade: 0.01, from: R.next() * model.clipDuration( idle ) } );
			model.update( 0 );
			const p = { model, spot: s, idle, oneShot: false, near: false };
			// one-shot clips (a shrug, a wave) hand back to the loop the person is in
			model.onClipEnd = () => {

				p.oneShot = false;
				model.play( p.loop, { fade: 0.5 } );

			};

			p.loop = idle;
			this.people.push( p );
			this.group.add( g );
			if ( s.group !== undefined ) {

				if ( ! this.circles.has( s.group ) ) this.circles.set( s.group, { members: [], speaker: - 1, t: R.next() * 3 } );
				this.circles.get( s.group ).members.push( p );

			}

		}

	}

	_loop( p, clip ) {

		p.loop = clip;
		if ( ! p.oneShot ) p.model.play( clip, { fade: 0.6, from: this.rand.next() * 0.5 } );

	}

	update( dt, camera ) {

		if ( ! this.people.length ) return;
		const R = this.rand;
		// conversations: a speaker for a few seconds, then another (or a pause); a listener shrugs now and then
		for ( const c of this.circles.values() ) {

			c.t -= dt;
			if ( c.t > 0 ) continue;
			const prev = c.speaker;
			c.speaker = c.members.length > 1 && R.next() < 0.85 ? ( prev + 1 + Math.floor( R.next() * ( c.members.length - 1 ) ) ) % c.members.length : - 1;
			c.t = 3 + R.next() * 5;
			c.members.forEach( ( p, i ) => {

				if ( i === c.speaker ) this._loop( p, TALK[ Math.floor( R.next() * TALK.length ) ] );
				else if ( p.loop.startsWith( 'gestic_talk' ) || R.next() < 0.3 ) this._loop( p, LISTEN[ Math.floor( R.next() * LISTEN.length ) ] );
				if ( i !== c.speaker && ! p.oneShot && R.next() < 0.08 ) {

					p.oneShot = true;
					p.model.play( 'gestic_shrug_01', { fade: 0.35, loop: false } );

				}

			} );

		}

		const cam = camera.position;
		for ( const p of this.people ) {

			const s = p.spot, d2 = ( cam.x - s.x ) ** 2 + ( cam.z - s.z ) ** 2;
			p.model.group.visible = d2 < SHOW * SHOW;
			if ( d2 > ANIMATE * ANIMATE ) {

				p.model.hold();
				continue;

			}

			// those standing alone (on a terrace) wave when you come up
			if ( s.group === undefined ) {

				const near = d2 < 64;
				if ( near && ! p.near && ! p.oneShot ) {

					p.oneShot = true;
					p.model.play( 'wave_01', { fade: 0.35, loop: false } );

				}

				p.near = near;

			}

			p.model.update( dt );

		}

	}

}

// Spots for a circle of n people round (x, z), facing its middle; y( x, z ) = the ground
export function circleSpots( x, z, n, group, y, rand ) {

	const out = [];
	const r = n <= 2 ? 0.55 : 0.75 + n * 0.06;
	const a0 = rand.next() * Math.PI * 2;
	for ( let i = 0; i < n; i ++ ) {

		const a = a0 + i / n * Math.PI * 2 + ( rand.next() - 0.5 ) * 0.5;
		const px = x + Math.cos( a ) * r, pz = z + Math.sin( a ) * r;
		// (models face local +z: turn toward the middle, give or take)
		out.push( { x: px, y: y( px, pz ), z: pz, yaw: Math.atan2( x - px, z - pz ) + ( rand.next() - 0.5 ) * 0.4, group } );

	}

	return out;

}
