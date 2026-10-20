// Loads the terrain built by tools/terrain/build_terrain.py (public/terrain/): terrain.json plus the
// height grids (uint16, deltas along each row, high byte plane then low byte plane, gzip) and the water
// body map (uint8 per far texel). Works in the browser (fetch + DecompressionStream) and in node tests
// (read from public/terrain/ on disk).

const IS_NODE = typeof process !== 'undefined' && !! ( process.versions && process.versions.node ) && typeof window === 'undefined';

async function readBytes( name ) {

	if ( IS_NODE ) {

		const fsName = 'node:fs/promises', urlName = 'node:url';
		const { readFile } = await import( /* @vite-ignore */ fsName );
		const { fileURLToPath } = await import( /* @vite-ignore */ urlName );
		const dir = fileURLToPath( new URL( '../../../public/terrain/', import.meta.url ) );
		return new Uint8Array( await readFile( dir + name ) );

	}

	const res = await fetch( new URL( 'terrain/' + name, document.baseURI ) );
	if ( ! res.ok ) throw new Error( `terrain/${ name }: ${ res.status }` );
	return new Uint8Array( await res.arrayBuffer() );

}

async function gunzip( bytes ) {

	// already inflated by the server (Content-Encoding) or not compressed
	if ( bytes[ 0 ] !== 0x1f || bytes[ 1 ] !== 0x8b ) return bytes;
	if ( IS_NODE ) {

		const zlibName = 'node:zlib';
		const { gunzipSync } = await import( /* @vite-ignore */ zlibName );
		return new Uint8Array( gunzipSync( bytes ) );

	}

	const stream = new Blob( [ bytes ] ).stream().pipeThrough( new DecompressionStream( 'gzip' ) );
	return new Uint8Array( await new Response( stream ).arrayBuffer() );

}

// heights in metres (y = 0 at the lake surface)
function decodeGrid( bytes, res, step, base ) {

	const n = res * res;
	if ( bytes.length !== 2 * n ) throw new Error( `terrain grid: ${ bytes.length } bytes for ${ res }^2` );
	const out = new Float32Array( n );
	for ( let j = 0; j < res; j ++ ) {

		let q = 0;
		const row = j * res;
		for ( let i = 0; i < res; i ++ ) {

			const k = row + i;
			q = ( q + ( ( bytes[ k ] << 8 ) | bytes[ n + k ] ) ) & 0xffff;
			out[ k ] = q * step + base;

		}

	}

	return out;

}

export async function loadTerrainFiles() {

	const meta = JSON.parse( new TextDecoder().decode( await readBytes( 'terrain.json' ) ) );
	const base = meta.encoding.base;
	const grids = {};
	await Promise.all( Object.entries( meta.grids ).map( async ( [ name, g ] ) => {

		const bytes = await gunzip( await readBytes( g.file ) );
		grids[ name ] = { size: g.size, res: g.res, texel: g.size / g.res, origin: - g.size / 2, heights: decodeGrid( bytes, g.res, g.step, base ) };

	} ) );
	const w = meta.water;
	const ids = await gunzip( await readBytes( w.file ) );
	if ( ids.length !== w.res * w.res ) throw new Error( 'terrain water map: unexpected size' );
	const water = { size: w.size, res: w.res, texel: w.size / w.res, origin: - w.size / 2, ids, bodies: w.bodies };
	return { meta, grids, water };

}
