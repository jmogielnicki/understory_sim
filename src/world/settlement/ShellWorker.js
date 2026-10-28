import { homeShape, homeField, shapeRand, meshShell } from './HomeShape.js';

// Meshes home shells off the main thread (Shells.js sends a batch of homes, gets their triangles back).
self.onmessage = ( e ) => {

	const out = [];
	const transfer = [];
	for ( const h of e.data.homes ) {

		const s = homeShape( h, shapeRand( h ) );
		const m = meshShell( s, homeField( s ), h.cell ?? e.data.cell );
		out.push( { id: h.id, ...m } );
		transfer.push( m.p.buffer, m.n.buffer, m.idx.buffer, m.turf.buffer, m.above.buffer );

	}

	self.postMessage( out, transfer );

};
