// Reference shots of named views (core/DebugViews.js) from a headless Chrome, for visual checks:
//   node tools/shots/shoot.mjs view1,view2 [--tag=name] [--out=dir] [--size=1280x634] [--url=http://127.0.0.1:5189/]
//     [--chrome=path] [--timeout=600] [--headful] [--port=5191] [--extra=&foo&bar]
//   node tools/shots/shoot.mjs --bench [--tag=name] [--size=...] [--extra=&benchViews=a,b]: the frame-time benchmark (?bench&auto): the default
//     views' shots, then <out>/bench-<tag>.json with the wall / GPU ms per view
// Needs the dev server (npm run dev). The page runs ?bench&shots=… (core/Bench.js), which renders each view with
// the clock stopped and uploads it as raw BGRA8 (8-byte width / height header) to the collector here, which writes
// <out>/<tag>-<view>.png. Exits when every view has arrived (or on timeout).
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { deflateSync } from 'node:zlib';

const args = Object.fromEntries( process.argv.slice( 3 ).map( ( a ) => {

	const m = a.match( /^--([^=]+)(?:=(.*))?$/ );
	return m ? [ m[ 1 ], m[ 2 ] ?? true ] : [ a, true ];

} ) );
const benchMode = process.argv[ 2 ] === '--bench';
const views = benchMode ? [] : ( process.argv[ 2 ] || 'aerial' ).split( ',' );
const tag = args.tag || 'shot';
const outDir = args.out || 'shots';
const size = args.size || '1280x634';
const base = args.url || 'http://127.0.0.1:5189/';
const chrome = args.chrome || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const timeout = Number( args.timeout || 600 ) * 1000;
const port = Number( args.port || 5191 );
mkdirSync( outDir, { recursive: true } );

const crcTable = new Int32Array( 256 ).map( ( _, n ) => {

	let c = n;
	for ( let k = 0; k < 8; k ++ ) c = c & 1 ? 0xedb88320 ^ ( c >>> 1 ) : c >>> 1;
	return c;

} );
const crc = ( buf ) => {

	let c = - 1;
	for ( const b of buf ) c = crcTable[ ( c ^ b ) & 255 ] ^ ( c >>> 8 );
	return ( c ^ - 1 ) >>> 0;

};
const chunk = ( type, data ) => {

	const out = Buffer.alloc( 12 + data.length );
	out.writeUInt32BE( data.length, 0 );
	out.write( type, 4, 'ascii' );
	data.copy( out, 8 );
	out.writeUInt32BE( crc( out.subarray( 4, 8 + data.length ) ), 8 + data.length );
	return out;

};
function png( width, height, bgra ) {

	const raw = Buffer.alloc( ( width * 3 + 1 ) * height );
	for ( let y = 0; y < height; y ++ ) {

		const row = y * ( width * 3 + 1 );
		for ( let x = 0; x < width; x ++ ) {

			const s = ( y * width + x ) * 4, d = row + 1 + x * 3;
			raw[ d ] = bgra[ s + 2 ]; raw[ d + 1 ] = bgra[ s + 1 ]; raw[ d + 2 ] = bgra[ s ];

		}

	}

	const ihdr = Buffer.alloc( 13 );
	ihdr.writeUInt32BE( width, 0 );
	ihdr.writeUInt32BE( height, 4 );
	ihdr[ 8 ] = 8; ihdr[ 9 ] = 2;
	return Buffer.concat( [ Buffer.from( [ 137, 80, 78, 71, 13, 10, 26, 10 ] ), chunk( 'IHDR', ihdr ), chunk( 'IDAT', deflateSync( raw ) ), chunk( 'IEND', Buffer.alloc( 0 ) ) ] );

}

let got = 0, browser = null;
const finish = ( code ) => {

	if ( browser ) browser.kill( 'SIGKILL' );
	server.close();
	process.exit( code );

};

const server = createServer( ( req, res ) => {

	res.setHeader( 'Access-Control-Allow-Origin', '*' );
	if ( req.method !== 'POST' ) return res.end();
	const parts = [];
	req.on( 'data', ( d ) => parts.push( d ) );
	req.on( 'end', () => {

		const body = Buffer.concat( parts );
		const name = decodeURIComponent( req.url.slice( 1 ) ).replace( /[^\w.-]/g, '_' );
		res.end( 'ok' );
		if ( name === 'log.txt' ) {

			process.stdout.write( '[page] ' + body.toString() + '\n' );
			return;

		}

		if ( ! name.endsWith( '.bgra' ) ) {

			writeFileSync( join( outDir, name ), body );
			console.log( 'file', join( outDir, name ) );
			if ( benchMode && name.endsWith( '.json' ) ) finish( 0 );
			return;

		}

		const w = body.readUInt32LE( 0 ), h = body.readUInt32LE( 4 );
		const file = join( outDir, name.replace( /\.bgra$/, '.png' ) );
		writeFileSync( file, png( w, h, body.subarray( 8 ) ) );
		console.log( 'shot', file, w + 'x' + h );
		if ( ! benchMode && ++ got >= views.length ) finish( 0 );

	} );

} );

server.listen( port, '127.0.0.1', () => {

	const job = benchMode ? `auto=${ tag }` : `shots=${ views.join( ',' ) }&tag=${ tag }&size=${ size }`;
	const url = `${ base }?bench&noAudio&${ job }&collector=http://127.0.0.1:${ port }/${ args.extra || '' }`;
	console.log( 'open', url );
	const profile = mkdtempSync( join( tmpdir(), 'shots-chrome-' ) );
	const flags = [
		`--user-data-dir=${ profile }`, '--no-first-run', '--no-default-browser-check', '--enable-unsafe-webgpu',
		'--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
		'--window-size=1400,900', '--enable-logging=stderr', '--v=0',
	];
	if ( ! args.headful ) flags.push( '--headless=new' );
	browser = spawn( chrome, [ ...flags, url ], { stdio: [ 'ignore', 'ignore', 'pipe' ] } );
	browser.stderr.on( 'data', ( d ) => {

		const s = d.toString();
		for ( const line of s.split( '\n' ) ) if ( /CONSOLE|Uncaught|error/i.test( line ) && ! /gpu_|viz|dbus|ssl|GCM|registration/i.test( line ) ) console.log( '[chrome]', line.slice( 0, 400 ) );

	} );
	setTimeout( () => {

		console.log( 'timeout: got', got, 'of', views.length );
		finish( 1 );

	}, timeout );

} );
