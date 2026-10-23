import { Matrix4, Mesh } from '../../engine/index.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { Batch, Part } from '../village/GeoBuilder.js';
import { srgb } from '../terrain/TerrainShading.js';

// Lavender (reference/home-v2.png: clumps of it along every terrace and step): each clump a low dome of
// thin stems, grey-green below, a violet spike of florets at the top; each stem a pair of crossed strips,
// the florets drawn in the fragment shader and cut out (alpha tested). Swaying a little in the wind.
// One draw call for the village.
//
// uv: u across the strip (0..1), v up it (0..1); vdata: x seed, y stem height (m), z: 1 for the spike part
// of the clump (the leafy base strips: 0).

const SHADER = /* wgsl */`
	let d = in.vs.vData;
	let u = in.uv.x - 0.5;
	let v = in.uv.y;
	let H = d.y;
	let spike0 = 0.62;
	var cov = 0.0;
	var c = vec3f( 0.0 );
	if ( d.z > 0.5 ) {
		// the stem: a thin line; the spike: whorls of florets every ~1.5 cm, widest a little below the tip
		let stem = abs( u ) < 0.09;
		let t = sat( ( v - spike0 ) / ( 1.0 - spike0 ) );
		let whorl = fract( v * H / 0.016 + d.x * 7.0 );
		let w = select( 0.0, ( 0.45 - t * 0.25 ) * ( 0.75 + 0.25 * sin( whorl * 6.28 ) ), v > spike0 );
		let flor = abs( u ) < w && hash21( vec2f( floor( v * H / 0.016 ), floor( u * 6.0 ) + d.x * 31.0 ) ) > 0.2;
		if ( flor ) {
			cov = 1.0;
			let h = hash21( vec2f( floor( v * H / 0.016 ), d.x * 17.0 ) );
			c = mix( ${ srgb( 0.32, 0.22, 0.58 ) }, ${ srgb( 0.55, 0.42, 0.82 ) }, h * 0.7 + t * 0.3 );
		} else if ( stem ) {
			cov = 1.0;
			c = ${ srgb( 0.3, 0.38, 0.24 ) };
		}
	} else {
		// the leafy base: narrow grey-green leaves
		let lw = 0.5 * ( 1.0 - v );
		if ( abs( u ) < lw ) { cov = 1.0; c = mix( ${ srgb( 0.22, 0.3, 0.18 ) }, ${ srgb( 0.42, 0.5, 0.36 ) }, v ); }
	}
	if ( cov < 0.5 ) { discard; }
	s.albedo = c;
	s.roughness = 0.75;
	s.metalness = 0.0;
	s.normal = normalize( normalize( in.N ) * 0.4 + vec3f( 0.0, 1.0, 0.0 ) );
	s.translucency = c * 0.3;
`;

const SWAY = /* wgsl */`
	o.vData = v.vdata;
	// sway: the tops move, the bases stay (uv.y = height up the strip)
	let k = v.uv.y * v.uv.y * v.vdata.y;
	let ph = frame.time * 1.6 + v.position.x * 0.7 + v.position.z * 0.5 + v.vdata.x * 6.0;
	v.position = v.position + vec3f( sin( ph ) * 0.05 * k, 0.0, cos( ph * 0.8 ) * 0.04 * k );
`;

export function createLavenderMaterial() {

	const m = standard( { name: 'Lavender', roughness: 0.75, metalness: 0, side: 'double', alphaTest: 0.5, attributes: { tint: 'vec3f', vdata: 'vec4f' }, varyings: { vData: 'vec4f' } } );
	m.modules = [ commonModule ];
	m.vertex = SWAY;
	m.surface = SHADER;
	return m;

}

export class Lavender {

	constructor() {

		this.batch = new Batch();

	}

	// a clump at world (x, y, z), radius r (m)
	clump( x, y, z, r, rand ) {

		const P = [], N = [], UV = [], D = [], I = [];
		const strip = ( bx, bz, h, lean, ang, w, spike, seed ) => {

			for ( const a of [ ang, ang + Math.PI / 2 ] ) {

				const cx = Math.cos( a ) * w / 2, cz = Math.sin( a ) * w / 2;
				const tx = bx + lean[ 0 ] * h, tz = bz + lean[ 1 ] * h;
				const b = P.length / 3;
				P.push( bx - cx, 0, bz - cz, bx + cx, 0, bz + cz, tx + cx, h, tz + cz, tx - cx, h, tz - cz );
				for ( let k = 0; k < 4; k ++ ) N.push( - Math.sin( a ), 0.3, Math.cos( a ) );
				UV.push( 0, 0, 1, 0, 1, 1, 0, 1 );
				for ( let k = 0; k < 4; k ++ ) D.push( seed, h, spike ? 1 : 0, 0 );
				I.push( b, b + 1, b + 2, b, b + 2, b + 3 );

			}

		};

		const n = Math.round( 22 * r / 0.35 );
		for ( let k = 0; k < n; k ++ ) {

			const a = rand.next() * Math.PI * 2, d = Math.sqrt( rand.next() ) * r * 0.8;
			const bx = Math.cos( a ) * d * 0.4, bz = Math.sin( a ) * d * 0.4;
			// the stems splay out from the crown: longer in the middle
			const h = ( 0.45 + rand.next() * 0.2 ) * ( 1 - d / r * 0.3 ) * ( r / 0.35 ) ** 0.3;
			const lean = [ Math.cos( a ) * d / r * 0.7, Math.sin( a ) * d / r * 0.7 ];
			strip( bx, bz, h, lean, rand.next() * Math.PI, 0.05, true, rand.next() );

		}

		for ( let k = 0; k < 8; k ++ ) {

			const a = rand.next() * Math.PI * 2;
			strip( 0, 0, 0.22 + rand.next() * 0.1, [ Math.cos( a ) * 0.9, Math.sin( a ) * 0.9 ], a + Math.PI / 2, 0.06, false, rand.next() );

		}

		const m = new Matrix4().makeTranslation( x, y - 0.03, z );
		this.batch.add( new Part( P, N, UV, I ), m, [ 1, 1, 1 ], ( px, py, pz, i ) => [ D[ i * 4 ], D[ i * 4 + 1 ], D[ i * 4 + 2 ], 0 ] );

	}

	mesh() {

		if ( ! this.batch.vcount ) return null;
		const mesh = new Mesh( this.batch.build(), createLavenderMaterial() );
		mesh.name = 'village_lavender';
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		return mesh;

	}

}

