// The homes' shells (HomeShape.js) meshed in parallel in workers (ShellWorker.js): start it early in loading,
// await it before the village is built, hand the map to the Settlement. Where there are no workers (Node:
// the tests and tools) it resolves to an empty map and every home meshes itself.
//   const shells = await meshShells( homes, cell );   // Map: id -> { p, n, idx, turf, above }

export function meshShells( homes, cell = 0.18 ) {

	const out = new Map();
	if ( typeof Worker === 'undefined' ) return Promise.resolve( out );
	const n = Math.max( 1, Math.min( 8, ( navigator.hardwareConcurrency || 4 ) - 1 ) );
	// deal the homes out, the costly (fine-meshed) ones first, to whichever batch is lightest
	const cost = ( h ) => ( h.len || 14 ) / ( ( h.cell ?? cell ) ** 2 );
	const sorted = homes.slice().sort( ( a, b ) => cost( b ) - cost( a ) );
	const batches = Array.from( { length: n }, () => ( { homes: [], cost: 0 } ) );
	for ( const h of sorted ) {

		const b = batches.reduce( ( m, q ) => q.cost < m.cost ? q : m );
		b.homes.push( h );
		b.cost += cost( h );

	}

	const plain = ( h ) => JSON.parse( JSON.stringify( h ) );
	return Promise.all( batches.filter( ( b ) => b.homes.length ).map( ( b ) => new Promise( ( resolve ) => {

		const w = new Worker( new URL( './ShellWorker.js', import.meta.url ), { type: 'module' } );
		w.onmessage = ( e ) => {

			for ( const m of e.data ) out.set( m.id, m );
			w.terminate();
			resolve();

		};

		// (a failed worker leaves its homes to mesh themselves)
		w.onerror = ( e ) => {

			console.warn( 'Shells: worker failed', e.message );
			w.terminate();
			resolve();

		};

		w.postMessage( { homes: b.homes.map( plain ), cell } );

	} ) ) ).then( () => out );

}
