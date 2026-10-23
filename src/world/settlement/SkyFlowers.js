import { Part } from '../village/GeoBuilder.js';

// Sky flowers (reference/neighborhood-v2.png: tall white flowers on stems over the far hillside's trees):
// read here as the village's solar collectors, grown like everything else: a slender pale stem, a hub, and a
// ring of cupped white petals opening upward to the sky, veined with the pale blue of everyday technology
// (lit faintly at night). Plan: SKY_FLOWERS [ x, z, height, yaw ]. Builder keys: 'petal', 'stone' (the
// stem and hub, as plaster), 'glow' (the veins along each petal's spine).

const PETALS = 6;

// one petal: from the hub outward and up, widest past its middle, cupped across, the tip curling out.
// a = its heading round the hub, L = length, W = half width, rise = elevation at the base (rad)
function petalPart( a, L, W, rise ) {

	const NU = 10, NV = 6;
	const p = [], n = [], uv = [], idx = [];
	const ca = Math.cos( a ), sa = Math.sin( a );
	const at = ( u, v ) => {

		// spine: rising at `rise`, flattening outward toward the tip
		const e = rise * ( 1 - u * 0.45 );
		const s = u * L;
		const r = s * Math.cos( e ) * 0.92 + 0.25, y = s * Math.sin( e ) * ( 1 - u * 0.15 );
		const w = Math.sin( Math.PI * Math.pow( u, 0.75 ) ) * W * ( 1 - u * 0.25 ) + 0.05;
		// across: the side direction is horizontal, perpendicular to the heading; cupped up at the edges
		const cup = v * v * w * 0.35;
		return [ ca * r - sa * v * w, y + cup, sa * r + ca * v * w ];

	};

	for ( let i = 0; i <= NU; i ++ ) for ( let j = 0; j <= NV; j ++ ) {

		const u = i / NU, v = j / NV * 2 - 1;
		const q = at( u, v );
		// normal from the neighbouring points
		const du = at( Math.min( 1, u + 0.02 ), v ), dv = at( u, Math.min( 1, v + 0.05 ) ), d0 = at( u, v );
		const ux = du[ 0 ] - d0[ 0 ], uy = du[ 1 ] - d0[ 1 ], uz = du[ 2 ] - d0[ 2 ];
		const vx = dv[ 0 ] - d0[ 0 ], vy = dv[ 1 ] - d0[ 1 ], vz = dv[ 2 ] - d0[ 2 ];
		let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
		const l = Math.hypot( nx, ny, nz ) || 1;
		if ( ny < 0 ) {

			nx = - nx; ny = - ny; nz = - nz;

		}

		p.push( ...q );
		n.push( nx / l, ny / l, nz / l );
		uv.push( u, v );

	}

	for ( let i = 0; i < NU; i ++ ) for ( let j = 0; j < NV; j ++ ) {

		const k = i * ( NV + 1 ) + j;
		idx.push( k, k + 1, k + NV + 2, k, k + NV + 2, k + NV + 1 );

	}

	return new Part( p, n, uv, idx );

}

export function buildSkyFlower( B, x, y, z, H, yaw, rand ) {

	B.pushAt( x, y, z, yaw, ( rand.next() - 0.5 ) * 0.06, ( rand.next() - 0.5 ) * 0.06 );
	// the stem: slender, swelling a little at the foot, a collar under the hub
	B.lathe( 'stone', 0, - 0.5, 0, [ [ 0.8, 0 ], [ 0.6, 0.8 ], [ 0.42, 3 ], [ 0.32, H * 0.6 ], [ 0.28, H - 0.6 ], [ 0.6, H - 0.15 ], [ 0.75, H + 0.3 ], [ 0.45, H + 0.7 ], [ 0.001, H + 0.8 ] ], { segs: 14, data: [ rand.next(), 8, 0, - 3 ] } );
	const L = H * 0.3, W = L * 0.24;
	for ( let k = 0; k < PETALS; k ++ ) {

		const a = k / PETALS * Math.PI * 2 + rand.next() * 0.08;
		const rise = 1.0 + rand.next() * 0.1;
		B.part( 'petal', petalPart( a, L, W, rise ), 0, H + 0.2, 0, { data: [ rand.next(), 0, 0, 0 ], tint: [ 0.96, 0.95, 0.97 ] } );

	}

	B.pop();

}
