import { Matrix4, Mesh } from '../../engine/index.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { Batch, Part } from '../village/GeoBuilder.js';

// A thin wisp of smoke from some chimneys (reference/home-v2.png). Three crossed strips per chimney, leaning
// with the wind as they rise; the puffs are noise scrolling up the strip, thinning and widening with height.
// Blended (a soft, thin translucency, no depth write); it casts no shadow.
//
// uv: u across the strip (0..1), v up it (metres); vdata: x seed, y strip height (m).

const SHADER = /* wgsl */`
	let d = in.vs.vData;
	let u = in.uv.x - 0.5;
	let v = in.uv.y;
	let H = d.y;
	let t = sat( v / H );
	// the column widens as it rises and curls; puffs drift up it and break apart near the top
	let w = mix( 0.16, 0.75, sqrt( t ) );
	let curl = sin( v * 1.3 - frame.time * 0.5 + d.x * 9.0 ) * 0.12 * t;
	let q = vec2f( ( u - curl ) * 2.0 / w, v * 1.6 - frame.time * 0.6 + d.x * 17.0 );
	let n = perlin2( q * vec2f( 1.2, 1.0 ) ) * 0.5 + 0.5 + perlin2( q * 2.7 + 5.0 ) * 0.15;
	let edge = 1.0 - smoothstep( 0.2, 1.0, abs( u - curl ) / ( w * 0.5 + 1e-3 ) );
	let dens = smoothstep( 0.3, 0.62, n ) * edge * pow( 1.0 - t, 0.6 ) * smoothstep( 0.0, 0.05, t );
	if ( dens < 0.02 ) { discard; }
	s.albedo = vec3f( 0.7, 0.7, 0.7 ) * ( 0.85 + n * 0.2 );
	s.roughness = 1.0;
	s.metalness = 0.0;
	s.normal = normalize( in.V );
	s.translucency = vec3f( 0.25 );
	s.alpha = dens * 0.35;
`;

const SWAY = /* wgsl */`
	o.vData = v.vdata;
	// lean downwind with height, and waver
	let h = v.uv.y;
	let ph = frame.time * 0.4 + v.vdata.x * 9.0;
	v.position = v.position + vec3f( frame.windDir.x, 0.0, frame.windDir.y ) * ( h * h * 0.05 * ( 0.6 + frame.windSpeed * 0.08 ) ) + vec3f( sin( ph + h ) * 0.06 * h, 0.0, cos( ph * 0.7 + h ) * 0.05 * h );
`;

export class Smoke {

	constructor() {

		this.batch = new Batch();

	}

	// a wisp rising from world point (x, y, z), H metres tall
	add( x, y, z, H, rand ) {

		const P = [], N = [], UV = [], I = [];
		const W = 1.6;
		for ( let k = 0; k < 3; k ++ ) {

			const a = k / 3 * Math.PI;
			const cx = Math.cos( a ) * W / 2, cz = Math.sin( a ) * W / 2;
			const b = P.length / 3;
			const n = 6;
			for ( let j = 0; j <= n; j ++ ) {

				const h = H * j / n;
				P.push( - cx, h, - cz, cx, h, cz );
				N.push( - Math.sin( a ), 0, Math.cos( a ), - Math.sin( a ), 0, Math.cos( a ) );
				UV.push( 0, h, 1, h );
				if ( j > 0 ) {

					const r = b + ( j - 1 ) * 2;
					I.push( r, r + 1, r + 3, r, r + 3, r + 2 );

				}

			}

		}

		const seed = rand.next();
		this.batch.add( new Part( P, N, UV, I ), new Matrix4().makeTranslation( x, y, z ), [ 1, 1, 1 ], [ seed, H, 0, 0 ] );

	}

	mesh() {

		if ( ! this.batch.vcount ) return null;
		const m = standard( { name: 'ChimneySmoke', roughness: 1, metalness: 0, side: 'double', transparent: true, depthWrite: false, attributes: { tint: 'vec3f', vdata: 'vec4f' }, varyings: { vData: 'vec4f' } } );
		m.modules = [ commonModule ];
		m.vertex = SWAY;
		m.surface = SHADER;
		const mesh = new Mesh( this.batch.build(), m );
		mesh.name = 'village_smoke';
		mesh.castShadow = false;
		mesh.receiveShadow = false;
		return mesh;

	}

}
