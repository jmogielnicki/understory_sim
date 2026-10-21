import { Matrix4, Mesh } from '../../engine/index.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { Batch, Part } from '../village/GeoBuilder.js';
import { srgb } from '../terrain/TerrainShading.js';

// The village's own water, above the lake: the stream (a ribbon down its channel, rippling along the flow,
// white where it falls) and the lily pond (a still sheet, tea-dark, reflecting the sky), with lily pads and
// their flowers. Opaque: the brook and the pond are seen by their reflections, not through.
//
// Batch attributes: uv (stream: u across in metres, v along the flow in metres; pond: world xz), tint,
// vdata (x: slope of the bed (stream) / -1 (pond), y: seed).

const WATER = /* wgsl */`
	let d = in.vs.vData;
	let slope = max( d.x, 0.0 );
	let pond = d.x < 0.0;
	let t = frame.time;
	// ripples: two layers scrolling down the stream (faster where it is steep); on the pond a slow drift
	let speed = select( 0.35 + slope * 6.0, 0.03, pond );
	let uv = in.uv;
	let q1 = vec2f( uv.x * 1.7, uv.y * 0.9 - t * speed );
	let q2 = vec2f( uv.x * 3.9 + 3.1, uv.y * 2.3 - t * speed * 1.35 );
	let e = 0.06;
	let h = perlin2( q1 ) * 0.6 + perlin2( q2 ) * 0.4;
	let hx = perlin2( q1 + vec2f( e, 0.0 ) ) * 0.6 + perlin2( q2 + vec2f( e, 0.0 ) ) * 0.4 - h;
	let hy = perlin2( q1 + vec2f( 0.0, e ) ) * 0.6 + perlin2( q2 + vec2f( 0.0, e ) ) * 0.4 - h;
	let amp = select( 0.18 + slope * 1.4, 0.035, pond );
	let nT = normalize( vec3f( - hx / e * amp, - hy / e * amp, 1.0 ) );
	s.normal = perturbNormalByMap( in.P, normalize( in.N ), uv, nT );
	// tea-dark, faintly green; white water where it tumbles
	let foam = select( smoothstep( 0.12, 0.35, slope ) * smoothstep( 0.35, 0.75, perlin2( q2 * 1.7 ) * 0.5 + 0.5 + slope ), 0.0, pond );
	// the pond deep and tea-dark; the brook shallow over its stones: clear, golden brown, mottled
	let stones = perlin2( uv * vec2f( 2.2, 1.3 ) + 7.0 ) * 0.5 + 0.5;
	let brook = mix( ${ srgb( 0.12, 0.1, 0.06 ) }, ${ srgb( 0.26, 0.21, 0.12 ) }, stones );
	let base = select( brook, ${ srgb( 0.035, 0.045, 0.03 ) }, pond );
	s.albedo = mix( base, ${ srgb( 0.82, 0.84, 0.82 ) }, foam );
	s.roughness = mix( 0.02, 0.55, foam );
	s.metalness = 0.0;
`;

export function createWaterMaterial() {

	const m = standard( { name: 'VillageWater', roughness: 0.03, metalness: 0, attributes: { tint: 'vec3f', vdata: 'vec4f' }, varyings: { vData: 'vec4f' } } );
	m.modules = [ commonModule ];
	m.vertex = '\to.vData = v.vdata;\n';
	m.surface = WATER;
	return m;

}

// lily pads: waxy green discs with a notch and radial veins; flowers: white and pink cups
export function createLilyMaterial() {

	const m = standard( { name: 'Lilies', roughness: 0.45, metalness: 0, attributes: { tint: 'vec3f', vdata: 'vec4f' }, varyings: { vTint: 'vec3f', vData: 'vec4f' } } );
	m.modules = [ commonModule ];
	m.vertex = '\to.vTint = v.tint;\n\to.vData = v.vdata;\n';
	m.surface = /* wgsl */`
	let uv = in.uv;
	let r = length( uv );
	let a = atan2( uv.y, uv.x );
	let vein = smoothstep( 0.9, 1.0, cos( a * 13.0 ) ) * smoothstep( 0.15, 0.6, r ) * ( 1.0 - in.vs.vData.y );
	var c = in.vs.vTint * ( 1.0 - vein * 0.25 );
	c = c * ( 0.9 + perlin2( uv * 9.0 + in.vs.vData.x * 7.0 ) * 0.12 );
	s.albedo = c;
	s.roughness = mix( 0.35, 0.7, in.vs.vData.y );
`;
	return m;

}

const IDENTITY = new Matrix4();

// stream ribbon from Grading.stream() samples (skipping the stretch through the pond and below the lake)
export function streamPart( samples, pond ) {

	const P = [], N = [], UV = [], T = [], D = [], I = [];
	let row = 0;
	for ( let i = 0; i < samples.length; i ++ ) {

		const q = samples[ i ];
		const inPond = pond && q.seg >= pond.inlet && q.seg < pond.outlet;
		if ( inPond || q.water < 0.02 ) {

			row = 0;
			continue;

		}

		const a = samples[ Math.max( 0, i - 1 ) ], b = samples[ Math.min( samples.length - 1, i + 1 ) ];
		let dx = b.x - a.x, dz = b.z - a.z;
		const l = Math.hypot( dx, dz ) || 1;
		dx /= l; dz /= l;
		const hw = q.w * 0.5 + 0.35;
		for ( const side of [ - 1, 1 ] ) {

			P.push( q.x - dz * hw * side, q.water, q.z + dx * hw * side );
			N.push( 0, 1, 0 );
			UV.push( side * hw, q.s );
			T.push( 1, 1, 1 );
			D.push( q.slope, 0, 0, 0 );

		}

		if ( row > 0 ) {

			// (facing up: the side -1 vertex lies to the right of the flow)
			const v = P.length / 3 - 4;
			I.push( v, v + 3, v + 2, v, v + 1, v + 3 );

		}

		row ++;

	}

	const b = new Batch();
	const part = new Part( P, N, UV, I );
	b.add( part, IDENTITY, [ 1, 1, 1 ], ( x, y, z, k ) => [ D[ k * 4 ], D[ k * 4 + 1 ], 0, 0 ] );
	return b;

}


// the pond's sheet: an ellipse a little larger than the basin (its edge runs under the rim)
export function pondPart( P ) {

	const pos = [ P.x, P.level, P.z ], nrm = [ 0, 1, 0 ], uv = [ P.x, P.z ], idx = [];
	const n = 48, c = Math.cos( P.yaw ), s = Math.sin( P.yaw );
	for ( let k = 0; k < n; k ++ ) {

		const a = k / n * Math.PI * 2;
		const lx = Math.cos( a ) * ( P.rx + 1.2 ), lz = Math.sin( a ) * ( P.rz + 1.2 );
		const x = P.x + lx * c + lz * s, z = P.z - lx * s + lz * c;
		pos.push( x, P.level, z );
		nrm.push( 0, 1, 0 );
		uv.push( x, z );
		idx.push( 0, 1 + ( k + 1 ) % n, 1 + k );

	}

	const b = new Batch();
	b.add( new Part( pos, nrm, uv, idx ), IDENTITY, [ 1, 1, 1 ], [ - 1, 0, 0, 0 ] );
	return b;

}

// lily pads (and a flower on some) scattered over the pond's quieter half
export function lilyBatch( P, rand ) {

	const b = new Batch();
	const pads = [];
	const c = Math.cos( P.yaw ), s = Math.sin( P.yaw );
	for ( let k = 0; k < 400 && pads.length < 70; k ++ ) {

		const a = rand.next() * Math.PI * 2, r = Math.sqrt( rand.next() ) * 0.92;
		const lx = Math.cos( a ) * r * P.rx, lz = Math.sin( a ) * r * P.rz;
		// clumps toward the north-west shore
		if ( lx * 0.5 + lz * 0.8 > rand.next() * 10 - 3 ) continue;
		const x = P.x + lx * c + lz * s, z = P.z - lx * s + lz * c;
		const rr = 0.16 + rand.next() * 0.2;
		if ( pads.some( ( q ) => Math.hypot( q[ 0 ] - x, q[ 1 ] - z ) < q[ 2 ] + rr + 0.02 ) ) continue;
		pads.push( [ x, z, rr ] );

	}

	for ( const [ x, z, r ] of pads ) {

		// disc with a notch (the pad), uv = local metres / r
		const pos = [ 0, 0, 0 ], nrm = [ 0, 1, 0 ], uv = [ 0, 0 ], idx = [];
		const n = 14, notch = 0.35, rot = rand.next() * Math.PI * 2;
		for ( let k = 0; k <= n; k ++ ) {

			const a = rot + notch + ( Math.PI * 2 - notch ) * k / n;
			pos.push( Math.cos( a ) * r, 0, Math.sin( a ) * r );
			nrm.push( 0, 1, 0 );
			uv.push( Math.cos( a ), Math.sin( a ) );
			if ( k > 0 ) idx.push( 0, k + 1, k );

		}

		const green = [ 0.12 + rand.next() * 0.06, 0.22 + rand.next() * 0.08, 0.05 + rand.next() * 0.03 ];
		const m = new Matrix4().makeTranslation( x, P.level + 0.012, z );
		b.add( new Part( pos, nrm, uv, idx ), m, green, [ rand.next(), 0, 0, 0 ] );
		if ( rand.next() < 0.22 ) {

			// a flower: a small cup of petals
			const fp = [], fn = [], fu = [], fi = [];
			const petals = 10, pink = rand.next() < 0.35;
			for ( let k = 0; k < petals; k ++ ) {

				const a = k / petals * Math.PI * 2;
				const b0 = fp.length / 3;
				const ca = Math.cos( a ), sa = Math.sin( a );
				fp.push( 0, 0.02, 0, ca * 0.07 - sa * 0.025, 0.05, sa * 0.07 + ca * 0.025, ca * 0.07 + sa * 0.025, 0.05, sa * 0.07 - ca * 0.025 );
				for ( let q = 0; q < 3; q ++ ) fn.push( ca * 0.5, 0.85, sa * 0.5 );
				fu.push( 0, 0, 0.3, 0.3, 0.3, - 0.3 );
				fi.push( b0, b0 + 1, b0 + 2 );

			}

			const fm = new Matrix4().makeTranslation( x + ( rand.next() - 0.5 ) * r, P.level + 0.02, z + ( rand.next() - 0.5 ) * r );
			b.add( new Part( fp, fn, fu, fi ), fm, pink ? [ 0.85, 0.5, 0.6 ] : [ 0.92, 0.9, 0.84 ], [ rand.next(), 1, 0, 0 ] );

		}

	}

	return b;

}

export function waterMeshes( stream, pond, rand ) {

	const water = createWaterMaterial();
	const meshes = [];
	const sb = streamPart( stream, pond );
	if ( sb.vcount ) meshes.push( new Mesh( sb.build(), water ) );
	meshes.push( new Mesh( pondPart( pond ).build(), water ) );
	const lily = new Mesh( lilyBatch( pond, rand ).build(), createLilyMaterial() );
	lily.material.side = 'double';
	meshes.push( lily );
	for ( const m of meshes ) {

		m.receiveShadow = true;
		m.castShadow = false;
		m.name = 'village_water';

	}

	return meshes;

}
