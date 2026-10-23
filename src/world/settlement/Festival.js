import { Color, Vector3 } from '../../engine/index.js';
import { Part, sagPoints } from '../village/GeoBuilder.js';

// The festival ground on the green (reference/neighborhood-v2.png): big open-grown oaks, tall timber poles
// with strings of paper lanterns and little cloth pennants swagged between them and into the oaks, and long
// trestle tables with benches under them. Plan: FESTIVAL (Plan.js). Returns the lanterns' light sources.

const GREY_OAK = [ 0.6, 0.55, 0.48 ];
const OAK = [ 0.62, 0.45, 0.3 ];
const PAPER = [ [ 0.85, 0.22, 0.12 ], [ 0.95, 0.55, 0.15 ], [ 0.95, 0.8, 0.3 ], [ 0.92, 0.88, 0.75 ], [ 0.3, 0.55, 0.6 ], [ 0.75, 0.35, 0.45 ] ];
const PENNANT = [ [ 0.8, 0.25, 0.15 ], [ 0.9, 0.7, 0.25 ], [ 0.25, 0.45, 0.6 ], [ 0.92, 0.88, 0.78 ], [ 0.4, 0.55, 0.3 ] ];
const POLE_H = 5.2;

function trestle( B, x, y, z, yaw, rand ) {

	B.pushAt( x, y, z, yaw );
	const L = 5.2, W = 0.9, H = 0.76;
	const wood = () => ( { data: [ rand.next(), 0, 6, 0.5 ], tint: OAK } );
	B.box( 'wood', 0, H - 0.03, 0, L, 0.06, W, wood() );
	for ( const sx of [ - 1, 1 ] ) {

		// the trestles: splayed legs and a foot rail
		for ( const sz of [ - 1, 1 ] ) B.beam( 'wood', [ sx * ( L / 2 - 0.5 ), H - 0.06, sz * 0.3 ], [ sx * ( L / 2 - 0.5 ), 0, sz * 0.42 ], 0.07, 0.07, wood() );
		B.box( 'wood', sx * ( L / 2 - 0.5 ), 0.25, 0, 0.06, 0.06, 0.8, wood() );
		// benches either side
		B.box( 'wood', 0, 0.44, sx * 0.85, L - 0.2, 0.05, 0.32, wood() );
		for ( const bx of [ - 1, 1 ] ) B.box( 'wood', bx * ( L / 2 - 0.6 ), 0.21, sx * 0.85, 0.06, 0.42, 0.28, wood() );

	}

	// a runner, jugs and bowls along it
	B.box( 'fabric', 0, H + 0.002, 0, L - 0.4, 0.004, 0.36, { data: [ rand.next(), 0, 0, 0 ], tint: [ 0.86, 0.8, 0.66 ] } );
	for ( let k = 0; k < 6; k ++ ) {

		const px = ( rand.next() - 0.5 ) * ( L - 0.8 );
		if ( rand.next() < 0.5 ) B.lathe( 'stone', px, H + 0.005, ( rand.next() - 0.5 ) * 0.3, [ [ 0.06, 0 ], [ 0.08, 0.1 ], [ 0.06, 0.2 ], [ 0.04, 0.24 ] ], { segs: 10, data: [ rand.next(), 6, 0, 0 ] } );
		else B.lathe( 'stone', px, H + 0.005, ( rand.next() - 0.5 ) * 0.3, [ [ 0.05, 0 ], [ 0.13, 0.07 ], [ 0.12, 0.075 ] ], { segs: 12, data: [ rand.next(), 6, 0, 0 ] } );

	}

	B.pop();

}

export function buildFestival( B, F, ground, rand, plantings, footprints ) {

	const lights = [];
	// the oaks: broad, open-grown (the vegetation's oak, as village plantings)
	for ( const [ x, z, s ] of F.oaks ) plantings.push( { x, z, y: ground( x, z ) - 0.2, s, sy: 0.78, sp: 1, kind: 'tree' } );
	// the poles
	const poles = F.poles.map( ( [ x, z ] ) => {

		const g = ground( x, z );
		B.box( 'wood', x, g + POLE_H / 2 - 0.3, z, 0.16, POLE_H + 0.6, 0.16, { data: [ rand.next(), 0, 0, 0.6 ], tint: GREY_OAK } );
		B.lathe( 'wood', x, g + POLE_H + 0.3, z, [ [ 0.1, 0 ], [ 0.001, 0.18 ] ], { segs: 4, ry: Math.PI / 4, data: [ rand.next(), 0, 0, 0.6 ], tint: GREY_OAK } );
		footprints.push( { x, z, r: 0.8, kind: 'play' } );
		return [ x, g + POLE_H, z ];

	} );

	// where a string meets an oak: in the lower crown, on the side facing the pole
	const anchor = ( a, toward ) => {

		if ( typeof a === 'number' ) return poles[ a ];
		const [ x, z, s ] = F.oaks[ + a.slice( 1 ) ];
		const dx = toward[ 0 ] - x, dz = toward[ 2 ] - z, l = Math.hypot( dx, dz ) || 1;
		const r = 2.6 * s;
		return [ x + dx / l * r, ground( x, z ) + 4.4 * s, z + dz / l * r ];

	};

	let li = 0;
	for ( const [ a, b ] of F.strings ) {

		const pb = typeof b === 'number' ? poles[ b ] : null;
		const pa = anchor( a, pb ?? poles[ 0 ] );
		const p1 = pb ?? anchor( b, pa );
		const L = Math.hypot( p1[ 0 ] - pa[ 0 ], p1[ 2 ] - pa[ 2 ] );
		const n = Math.max( 6, Math.round( L / 0.8 ) );
		const pts = sagPoints( pa, p1, L * 0.06, n );
		for ( let i = 0; i < n; i ++ ) B.rod( 'hard', [ pts[ i ].x, pts[ i ].y, pts[ i ].z ], [ pts[ i + 1 ].x, pts[ i + 1 ].y, pts[ i + 1 ].z ], 0.007, 0.007, { segs: 4, data: [ rand.next(), 0.1, 0, 0 ], tint: [ 0.2, 0.18, 0.15 ] } );
		// lanterns on every other point, pennants between
		for ( let i = 1; i < n; i ++ ) {

			const p = pts[ i ];
			if ( i % 2 === 1 ) {

				const c = PAPER[ Math.floor( rand.next() * PAPER.length ) ];
				const r = 0.13 + rand.next() * 0.06, hh = r * ( 1.4 + rand.next() * 0.6 );
				const prof = [];
				for ( let k = 0; k <= 8; k ++ ) {

					const t = k / 8;
					prof.push( [ Math.max( 0.02, Math.sin( t * Math.PI ) * r ), - 0.08 - t * hh ] );

				}

				prof.reverse();
				B.lathe( 'lantern', p.x, p.y, p.z, prof, { segs: 10, data: [ rand.next(), 0, 0, 0 ], tint: c } );
				B.box( 'hard', p.x, p.y - 0.04, p.z, 0.005, 0.08, 0.005, { data: [ 0, 0, 0, 0 ], tint: [ 0.2, 0.18, 0.15 ] } );
				if ( li ++ % 4 === 0 ) lights.push( { position: new Vector3( p.x, p.y - 0.3, p.z ), color: new Color( 1.0, 0.72, 0.45 ), intensity: 3.2, kind: 'festival' } );

			} else {

				// a pennant: a small cloth triangle hanging from the string
				const q = pts[ i + 1 ] ?? p, dx = q.x - pts[ i - 1 ].x, dz = q.z - pts[ i - 1 ].z, l = Math.hypot( dx, dz ) || 1;
				const ux = dx / l * 0.14, uz = dz / l * 0.14;
				const part = new Part( [ - ux, 0, - uz, ux, 0, uz, 0, - 0.3, 0 ], [ - uz / 0.14, 0, ux / 0.14, - uz / 0.14, 0, ux / 0.14, - uz / 0.14, 0, ux / 0.14 ], [ 0, 0, 0.28, 0, 0.14, 0.3 ], [ 0, 1, 2 ] );
				B.part( 'fabric', part, p.x, p.y - 0.01, p.z, { data: [ rand.next(), 0.3, 0, 0 ], tint: PENNANT[ Math.floor( rand.next() * PENNANT.length ) ] } );

			}

		}

	}

	for ( const [ x, z, yaw ] of F.tables ) {

		trestle( B, x, ground( x, z ), z, yaw, rand );
		footprints.push( { x, z, r: 3.4, kind: 'play' } );

	}

	return lights;

}
