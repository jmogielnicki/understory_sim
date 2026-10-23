import { clamp, smin, smax, sdRoundRect, sdEllipse, sdArchOpening, noise3 } from './Sdf.js';

// The form of a home (reference/home-v2.png, docs/REFERENCE.md): a long, low body of pale plaster with
// rounded ends, its walls swelling into a domed roof under a thick planted cap that overhangs them like a
// lip; at one end, often, a great open arch: a vaulted outdoor room (kitchen and table) running back into
// the house, with a smaller arch through its end wall; arched doors and windows and round windows set deep
// in the front wall.
//
// Local frame: x along the front (to the right seen from the front), y up from the floor, z out of the hill
// (the front wall's face at z = 0, the body running back to z = -depth).
//
// homeShape( h, rand ) picks the dimensions and the openings; homeField( s ) gives the distance functions:
// house (the plastered shell), turf (the planted cap) and all (what is built: their union, the openings
// cut).

export function homeShape( h, rand ) {

	const L = h.len;
	const D = h.depth;
	const H = h.wall ?? rand.range( 2.75, 3.05 );
	const Hr = h.roofRise ?? rand.range( 1.8, 2.25 );
	const rc = Math.min( 2.6, D * 0.35 );
	const Rr = Math.min( 3.0, D * 0.4 );
	const s = { L, D, H, Hr, rc, Rr, seed: rand.next(), openings: [], loggia: null };
	let x0 = - L / 2 + rc + 0.4, x1 = L / 2 - rc - 0.4; // the straight run of the front wall
	if ( h.loggia ) {

		const sg = h.loggia === 'left' ? - 1 : 1;
		const S = h.loggiaSpan ?? rand.range( 5.4, 6.2 ), R = h.loggiaRise ?? rand.range( 3.9, 4.3 ), T = 0.55;
		const Dl = Math.min( D - 1.6, 4.6 );
		const xc = sg * ( L / 2 - S / 2 - T + 0.15 );
		s.loggia = { sg, S, R, T, Dl, xc, side: h.loggiaSide ?? true };
		if ( sg > 0 ) x1 = Math.min( x1, xc - S / 2 - T - 0.5 );
		else x0 = Math.max( x0, xc + S / 2 + T + 0.5 );

	}

	// the front door, then windows along the rest of the straight run (arched, now and then a round one high
	// up), at least ~0.7 m of wall between openings
	const run = x1 - x0;
	const door = { kind: 'door', x: 0, w: 1.2, spring: 1.6, r: 0.6 };
	door.x = s.loggia ? ( s.loggia.sg > 0 ? x1 - 0.9 - rand.next() * Math.max( 0, run * 0.3 ) : x0 + 0.9 + rand.next() * Math.max( 0, run * 0.3 ) ) : ( x0 + x1 ) / 2 + rand.range( - 0.2, 0.2 ) * run;
	door.x = clamp( door.x, x0 + 0.7, x1 - 0.7 );
	s.openings.push( door );
	const free = ( x, w ) => s.openings.every( ( o ) => Math.abs( o.x - x ) > ( o.w + w ) / 2 + 0.75 );
	// windows outward from the door
	for ( const dir of [ - 1, 1 ] ) {

		let x = door.x + dir * ( door.w / 2 + 0.95 + rand.next() * 0.4 );
		for ( let k = 0; k < 6; k ++ ) {

			const round = rand.next() < 0.22;
			const w = round ? 0.84 : rand.range( 0.85, 1.0 );
			const cx = x + dir * w / 2;
			if ( cx - w / 2 < x0 || cx + w / 2 > x1 ) break;
			if ( free( cx, w ) ) s.openings.push( round ? { kind: 'round', x: cx, w, y: 1.75, r: 0.42 } : { kind: 'window', x: cx, w, sill: 0.85, spring: 1.55, r: w / 2 } );
			x = cx + dir * ( w / 2 + 0.8 + rand.next() * 1.4 );

		}

	}

	// a small round window high beside the door now and then (the reference: up under the roof's lip)
	const hx = door.x + ( rand.next() < 0.5 ? - 1 : 1 ) * ( door.w / 2 + 0.6 );
	if ( ( h.roundHigh || rand.next() < 0.5 ) && H > 2.8 && hx > x0 && hx < x1 && free( hx, 0.3 ) ) s.openings.push( { kind: 'round', x: hx, w: 0.52, y: H - 0.66, r: 0.24, high: true } );
	s.recess = 0.34;
	return s;

}

// the eave line: where the planted cap comes down to (wavy; over the loggia it sits on the arch's crown)
function eave( s, x ) {

	let y = s.H - 0.3 + noise3( x * 0.55, s.seed * 50, 0.5 ) * 0.16;
	const l = s.loggia;
	if ( l ) {

		const u = Math.abs( x - l.xc ) / ( l.S / 2 + l.T );
		const crown = l.R + l.T * 0.55 - 0.15 + ( 1 - Math.min( 1, u ) ** 2 ) * 0.1;
		y = y + ( crown - y ) * ( 1 - smoothstep( 0.75, 1.15, u ) );

	}

	return y;

}

const smoothstep = ( a, b, x ) => {

	const t = clamp( ( x - a ) / ( b - a ), 0, 1 );
	return t * t * ( 3 - 2 * t );

};

// the body's section: the plan distance dp (negative inside) and the height y; walls to H, then a rounded
// shoulder (Rr in, Hr up) to the flat crown
function bodySection( s, dp, y ) {

	const t = ( dp + s.Rr ) / s.Rr, w = ( y - s.H ) / s.Hr;
	if ( t > 0 && w > 0 ) return ( Math.hypot( t, w ) - 1 ) * Math.min( s.Rr, s.Hr );
	return Math.max( dp, y - s.H - s.Hr );

}

export function homeField( s ) {

	const l = s.loggia;
	const hz = s.D / 2;
	const plan = ( x, z ) => sdRoundRect( x, z + hz, s.L / 2, hz, s.rc );

	// the plastered house: body, the loggia's shell, a flat bottom under the ground
	const house = ( x, y, z ) => {

		// the walls swell a little toward their middle height (soft, hand-built)
		const swell = 0.06 * Math.sin( clamp( y / s.H, 0, 1 ) * Math.PI );
		let d = bodySection( s, plan( x, z ) + swell, y );
		if ( l ) {

			// the arch's shell: an elliptic barrel along z, proud of the front wall, its front edge rounded
			const ring = sdEllipse( x - l.xc, y, l.S / 2 + l.T, l.R + l.T );
			const shell = smax( ring, Math.max( z - 0.45, - z - l.Dl - 1.4 ), 0.25 );
			d = smin( d, shell, 0.5 );

		}

		return Math.max( d, - 0.9 - y );

	};

	// the openings: the loggia's room and its end arch, the door and window recesses
	const cut = ( x, y, z ) => {

		let c = Infinity;
		if ( l ) {

			const room = Math.max( sdEllipse( x - l.xc, y, l.S / 2, l.R ), - y, - z - l.Dl );
			c = Math.min( c, room );
			if ( l.side ) {

				// through the end wall: a smaller arch, centred on the room's depth
				const zc = - l.Dl * 0.48, a = Math.min( 1.7, l.Dl * 0.36 ), b = l.R * 0.78;
				const side = Math.max( sdEllipse( z - zc, y, a, b ), - y, - l.sg * ( x - l.xc ) );
				c = Math.min( c, side );

			}

		}

		if ( z > - s.recess - 0.5 ) {

			for ( const o of s.openings ) {

				let d;
				if ( o.kind === 'round' ) d = Math.hypot( x - o.x, y - o.y ) - o.r;
				else if ( o.kind === 'door' ) d = sdArchOpening( x - o.x, y, o.w, o.spring, o.r );
				else d = Math.max( sdArchOpening( x - o.x, y, o.w, o.spring, o.r ), o.sill - y );
				c = Math.min( c, Math.max( d, - z - s.recess ) );

			}

		}

		return c;

	};

	// the planted cap: the house grown outward, above the eave, lumpy
	const TT = 0.5;
	const capOf = ( hd, x, y, z ) => {

		const lump = hd - TT > 0.7 ? 0 : noise3( x * 0.8, y * 0.8, z * 0.8 + s.seed * 31 ) * 0.15 + noise3( x * 2.4, y * 2.4, z * 2.4 ) * 0.06;
		// (the lip rolls under: a rounded edge, not a cut)
		return smax( hd - TT - lump, eave( s, x ) - y, 0.24 );

	};

	const turf = ( x, y, z ) => capOf( house( x, y, z ), x, y, z );
	const all = ( x, y, z ) => {

		const hd = house( x, y, z );
		const d = Math.min( hd, capOf( hd, x, y, z ) );
		// (the openings only matter near the surface)
		return d > 0.3 ? d : smax( d, - cut( x, y, z ), 0.05 );

	};
	// (the box starts just under the floor: the underside is never seen, so it is left open)
	const lo = [ - s.L / 2 - 1.2, - 0.4, - s.D - 1.2 ];
	const hi = [ s.L / 2 + 1.2, Math.max( s.H + s.Hr, l ? l.R + l.T : 0 ) + 0.9, 1.3 ];
	return { house, turf, cut, all, lo, hi, eave: ( x ) => eave( s, x ) };

}
