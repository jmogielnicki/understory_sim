#!/usr/bin/env python3
"""Understory's terrain: Squam Lake, New Hampshire, from USGS 3DEP elevation.

    python3 -I tools/terrain/build_terrain.py [--cache .cache/terrain] [--out public/terrain] [--refetch]

Needs numpy, scipy and tifffile (pip install numpy scipy tifffile). Downloads are cached.

Coordinates. Everything is in metres on a transverse Mercator plane centred on the reference point
43°46'40.49"N 71°32'30.87"W (on the south flank of Rattlesnake Mountain): grid north is true north there.
The world origin sits CENTER (easting, northing) from that point; world x = easting - CENTER.x points
east, world z = CENTER.y - northing points south, world y = elevation - LAKE_LEVEL (the lake surface is
y = 0, as the sea was in Tidewater).

Three nested height grids, all 2048 x 2048 samples (sample centres at origin + (i + 0.5) * texel):
    near  2048 m at 1 m    the walkable area: shore, coves, the peninsula, the village slope
    mid   8192 m at 4 m    the lake around it with its islands and the hills behind
    far  32768 m at 16 m   the Squam Range, Red Hill, the Sandwich Range foothills, Winnipesaukee
Each coarser grid holds the block mean of the finer one inside the finer domain, so the client can blend
between them anywhere without a seam.

The lake bed. The lidar is hydro-flattened: lakes are one flat surface at their level (Squam: 170.66 m),
so the lake outline falls out of the data, but there is no bathymetry. The bed is generated: depth grows
with the distance from the shore, starting at a slope that follows the land at the nearest shore (rocky
points drop off steeply, coves stay shallow) and levelling out at a depth set by how far the open water
reaches (narrow channels and coves stay shallow, the open basin reaches ~25 m; Squam's deepest water is
about 30 m). A gentle noise field and a few hundred submerged boulder shoals (Squam is known for them)
break it up. Other hydro-flattened lakes and ponds keep their own level (water body map) and get a
shallow bed of the same kind.

Outputs (public/terrain/): near.bin.gz, mid.bin.gz, far.bin.gz (uint16 heights: y = q * step + base,
row-delta coded, gzip), water.bin.gz (uint8 water body id per far texel, 0 = dry, dilated two texels
under the shore), terrain.json (grids, encoding, water bodies, sources).
"""
import argparse
import gzip
import hashlib
import json
import math
import os
import urllib.parse
import urllib.request

import numpy as np
import tifffile
from scipy import ndimage

REF_LAT, REF_LON = 43.777914, -71.541908
CENTER = ( 150.0, -650.0 )
LAKE_LEVEL = 170.66
LAKE_POINT = ( 300.0, 600.0 )  # world xz in open water south of the village bay
BASE = -60.0  # world y of q = 0

GRIDS = [
	dict( name='near', size=2048, res=2048, margin=256, step=0.01 ),
	dict( name='mid', size=8192, res=2048, margin=1024, step=0.02 ),
	dict( name='far', size=32768, res=2048, margin=0, step=0.02 ),
]

WKT = ( 'PROJCS["Understory_TM",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],'
	'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",0.0],'
	f'PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",{ REF_LON }],PARAMETER["Scale_Factor",1.0],'
	f'PARAMETER["Latitude_Of_Origin",{ REF_LAT }],UNIT["Meter",1.0]]' )
SERVICE = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'


def fetch( cache, name, half, px, refetch ):
	"""Square DEM of half-extent `half` (m) around the world origin, px x px samples, rows north to south."""
	path = os.path.join( cache, f'{ name }-{ int( half * 2 ) }m-{ px }px.tif' )
	if refetch or not os.path.exists( path ):
		sr = json.dumps( { 'wkt': WKT } )
		cx, cy = CENTER
		params = dict( bbox=f'{ cx - half },{ cy - half },{ cx + half },{ cy + half }', bboxSR=sr, imageSR=sr, size=f'{ px },{ px }',
			format='tiff', pixelType='F32', interpolation='RSP_BilinearInterpolation', f='image' )
		url = SERVICE + '?' + urllib.parse.urlencode( params )
		print( 'fetch', name, f'{ half * 2 / 1000:.1f} km at { half * 2 / px:.1f} m' )
		data = urllib.request.urlopen( url, timeout=600 ).read()
		if data[ :2 ] not in ( b'II', b'MM' ):
			raise RuntimeError( f'{ name }: the elevation service did not return a TIFF: { data[ :200 ]!r}' )
		os.makedirs( cache, exist_ok=True )
		with open( path, 'wb' ) as f:
			f.write( data )
	h = tifffile.imread( path ).astype( np.float64 )
	if h.shape != ( px, px ) or not np.isfinite( h ).all() or h.min() < 0:
		raise RuntimeError( f'{ name }: bad elevation raster { h.shape } min { np.nanmin( h ) }' )
	return h, path


def coords( size, res, margin=0 ):
	"""World x (columns) and z (rows) of the sample centres of a grid with `margin` extra metres around it."""
	t = size / res
	n = res + 2 * int( round( margin / t ) )
	o = - size / 2 - margin
	c = o + ( np.arange( n ) + 0.5 ) * t
	return c, c  # x east by column, z south by row (rows run north to south in the raster)


def smooth_noise( x, z, seed, scales ):
	"""Deterministic smooth noise in about [-1, 1]: sums of randomly oriented waves, evaluable at any resolution."""
	rng = np.random.default_rng( seed )
	X, Z = np.meshgrid( x, z )
	acc = np.zeros_like( X )
	norm = 0.0
	for s, w in scales:
		for _ in range( 6 ):
			a = rng.uniform( 0, math.pi )
			ph = rng.uniform( 0, 2 * math.pi )
			k = 2 * math.pi / ( s * rng.uniform( 0.8, 1.25 ) )
			acc += w * np.sin( ( X * math.cos( a ) + Z * math.sin( a ) ) * k + ph )
			norm += w * w
	return acc / math.sqrt( norm * 3 )


def flat_level_mask( h, level, tol ):
	return np.abs( h - level ) < tol


def component_at( mask, ij ):
	lab, _ = ndimage.label( mask )
	k = lab[ ij ]
	if k == 0:
		raise RuntimeError( 'reference point is not in the masked region' )
	return lab == k


def world_index( x, z, size, res, margin ):
	t = size / res
	o = - size / 2 - margin
	return int( ( z - o ) / t ), int( ( x - o ) / t )


def lake_mask( h, g, tol, grow_tol ):
	"""Squam's surface: the flat component at the lake level that contains LAKE_POINT, grown by a texel into
	the blended shore texels of a resampled grid."""
	ij = world_index( *LAKE_POINT, g[ 'size' ], g[ 'res' ], g[ 'margin' ] )
	core = component_at( flat_level_mask( h, LAKE_LEVEL, tol ), ij )
	grown = ndimage.binary_dilation( core ) & ( h < LAKE_LEVEL + grow_tol )
	return core | grown


def land_slope_at_shore( h, water, texel, sigma_px ):
	"""Slope of the land, averaged over the land around each shore point, looked up for every water texel at
	its nearest land texel. Returns ( slope at nearest land per texel, distance to land in texels )."""
	gz, gx = np.gradient( ndimage.gaussian_filter( h, 1.0 ), texel )
	slope = np.hypot( gx, gz )
	land = ( ~ water ).astype( np.float64 )
	num = ndimage.gaussian_filter( slope * land, sigma_px )
	den = ndimage.gaussian_filter( land, sigma_px ) + 1e-6
	s_land = num / den
	dist, idx = ndimage.distance_transform_edt( water, return_indices=True )
	s0 = s_land[ idx[ 0 ], idx[ 1 ] ]
	# the nearest shore point jumps across the lake's medial lines: smooth the slope field there, more
	# the farther from the shore (the bed right off the shore keeps its local slope)
	w = np.clip( dist / ( 4 * sigma_px ), 0, 1 )
	s0 = s0 * ( 1 - w ) + ndimage.gaussian_filter( s0, sigma_px * 2 ) * w
	return s0, dist


def make_shoals( rng, count, region, accept ):
	"""Submerged boulder shoals: [x, z, radius, aspect, angle, crest depth]. `accept(x, z)` -> probability."""
	out = []
	tries = 0
	while len( out ) < count and tries < count * 200:
		tries += 1
		x = rng.uniform( region[ 0 ], region[ 1 ] )
		z = rng.uniform( region[ 2 ], region[ 3 ] )
		if rng.uniform() > accept( x, z ):
			continue
		r = rng.uniform( 4, 22 ) * ( 1.6 if rng.uniform() < 0.15 else 1.0 )
		out.append( [ x, z, r, rng.uniform( 1.0, 2.6 ), rng.uniform( 0, math.pi ), rng.uniform( 0.25, 2.8 ) ] )
	return out


def apply_shoals( depth, water, x, z, shoals ):
	"""Raise the bed to the shoals: a knobbly dome per shoal, its crest `crest depth` below the surface."""
	t = x[ 1 ] - x[ 0 ]
	for sx, sz, r, asp, ang, crest in shoals:
		R = r * asp * 3.2
		i0 = max( 0, int( ( sx - R - x[ 0 ] ) / t ) ); i1 = min( len( x ), int( ( sx + R - x[ 0 ] ) / t ) + 2 )
		j0 = max( 0, int( ( sz - R - z[ 0 ] ) / t ) ); j1 = min( len( z ), int( ( sz + R - z[ 0 ] ) / t ) + 2 )
		if i0 >= i1 or j0 >= j1:
			continue
		X, Z = np.meshgrid( x[ i0:i1 ] - sx, z[ j0:j1 ] - sz )
		ca, sa = math.cos( ang ), math.sin( ang )
		u = ( X * ca + Z * sa ) / ( r * asp )
		v = ( - X * sa + Z * ca ) / r
		q = np.sqrt( u * u + v * v )
		lump = 1 + 0.25 * np.sin( 3.1 * u + sx ) * np.sin( 2.7 * v + sz )
		# a rounded pile: flat-ish crest, flanks steepening to ~1:1, then a talus apron down to the bed
		rise = crest + r * ( 0.45 * q * q * lump + 0.9 * np.maximum( q - 0.8, 0 ) ** 1.5 )
		sub = depth[ j0:j1, i0:i1 ]
		w = water[ j0:j1, i0:i1 ]
		depth[ j0:j1, i0:i1 ] = np.where( w, np.minimum( sub, rise ), sub )


def bed_depth( d, s0, dmax, mult ):
	"""Depth (m) at distance d (m) from the shore: initial slope s0, levelling out at dmax."""
	return dmax * ( 1 - np.exp( - s0 * d / dmax ) ) * mult


def block_mean( a, f ):
	n = a.shape[ 0 ] // f
	return a[ :n * f, :n * f ].reshape( n, f, n, f ).mean( axis=( 1, 3 ) )


def crop( a, g ):
	m = int( round( g[ 'margin' ] / ( g[ 'size' ] / g[ 'res' ] ) ) )
	return a[ m:m + g[ 'res' ], m:m + g[ 'res' ] ] if m else a


def encode( h_world, step ):
	q = np.clip( np.round( ( h_world - BASE ) / step ), 0, 65535 ).astype( np.uint16 )
	delta = q.copy()
	delta[ :, 1: ] = q[ :, 1: ] - q[ :, :-1 ]  # uint16 wrap-around
	raw = delta.astype( '<u2' ).tobytes()
	# byte planes (high bytes, then low bytes) compress far better than interleaved
	planes = np.frombuffer( raw, dtype=np.uint8 ).reshape( -1, 2 )
	return gzip.compress( planes[ :, 1 ].tobytes() + planes[ :, 0 ].tobytes(), 9, mtime=0 ), q


def decode( q, step ):
	return q.astype( np.float64 ) * step + BASE


def main():
	ap = argparse.ArgumentParser()
	ap.add_argument( '--cache', default='.cache/terrain' )
	ap.add_argument( '--out', default='public/terrain' )
	ap.add_argument( '--refetch', action='store_true' )
	args = ap.parse_args()
	near_g, mid_g, far_g = GRIDS
	sources = {}

	# ---------------------------------------------------------------- download
	raw = {}
	for g in GRIDS:
		half = g[ 'size' ] / 2 + g[ 'margin' ]
		px = g[ 'res' ] + 2 * int( round( g[ 'margin' ] / ( g[ 'size' ] / g[ 'res' ] ) ) )
		raw[ g[ 'name' ] ], path = fetch( args.cache, g[ 'name' ], half, px, args.refetch )
		with open( path, 'rb' ) as f:
			sources[ g[ 'name' ] ] = hashlib.sha256( f.read() ).hexdigest()

	rng = np.random.default_rng( 1859 )

	# ---------------------------------------------------------------- mid: masks, slopes, basin scale
	h = raw[ 'mid' ]
	t_mid = mid_g[ 'size' ] / mid_g[ 'res' ]
	xm, zm = coords( mid_g[ 'size' ], mid_g[ 'res' ], mid_g[ 'margin' ] )
	water_m = lake_mask( h, mid_g, 0.004, 0.05 )
	s0_m, dist_m = land_slope_at_shore( h, water_m, t_mid, 3 )
	d_m = np.maximum( dist_m * t_mid - t_mid * 0.5, 0 )
	basin_m = ndimage.gaussian_filter( dist_m * t_mid, 300 / t_mid )
	dmax_m = np.clip( 3.0 + 0.032 * basin_m, 3.0, 27.0 )
	s0_m = np.clip( s0_m * 0.85, 0.025, 0.75 )
	mult_m = 1 + 0.16 * smooth_noise( xm, zm, 7, [ ( 900, 1.0 ), ( 340, 0.6 ) ] )

	# shoals: more of them off rocky points and around islands, between 1.5 and 14 m of water
	lake_d = bed_depth( d_m, s0_m, dmax_m, mult_m )
	def shoal_p( x, z ):
		j, i = world_index( x, z, mid_g[ 'size' ], mid_g[ 'res' ], mid_g[ 'margin' ] )
		if not water_m[ j, i ]:
			return 0.0
		dep = lake_d[ j, i ]
		if dep < 1.5 or dep > 14:
			return 0.0
		return 0.25 + 0.75 * min( 1.0, s0_m[ j, i ] / 0.35 ) * ( 1.0 if d_m[ j, i ] < 160 else 0.4 )
	half_mid = mid_g[ 'size' ] / 2
	shoals = make_shoals( rng, 420, ( - half_mid, half_mid, - half_mid, half_mid ), shoal_p )
	wm = water_m.astype( np.float64 )
	soft = ndimage.gaussian_filter( lake_d * wm, 4 ) / ( ndimage.gaussian_filter( wm, 4 ) + 1e-6 )
	k = np.clip( ( d_m - 20 ) / 60, 0, 1 )
	lake_d = lake_d * ( 1 - k ) + soft * k
	depth_m = lake_d.copy()
	apply_shoals( depth_m, water_m, xm, zm, shoals )
	mid_h = np.where( water_m, LAKE_LEVEL - depth_m, h )

	# ---------------------------------------------------------------- near: the same bed from the 1 m shore
	hn = raw[ 'near' ]
	xn, zn = coords( near_g[ 'size' ], near_g[ 'res' ], near_g[ 'margin' ] )
	water_n = lake_mask( hn, near_g, 0.004, 0.02 )
	_, dist_n = land_slope_at_shore( hn, water_n, 1.0, 12 )
	# the 1 m shore is exact nearby; past ~200 m the nearest shore may lie outside this crop, where the mid
	# grid's distance (4 m accurate) takes over
	def up( a ):
		# mid texel coordinates of the near sample centres
		fi = ( xn - xm[ 0 ] ) / t_mid
		fj = ( zn - zm[ 0 ] ) / t_mid
		J, I = np.meshgrid( fj, fi, indexing='ij' )
		return ndimage.map_coordinates( a, [ J, I ], order=1, mode='nearest' )
	d_far_n = up( d_m )
	d_n = np.maximum( dist_n - 0.5, 0 )
	d_n = np.where( d_n < 200, d_n, np.minimum( d_n, np.maximum( d_far_n, 200 ) ) )
	s0_n = up( s0_m )
	dmax_n = up( dmax_m )
	mult_n = 1 + 0.16 * smooth_noise( xn, zn, 7, [ ( 900, 1.0 ), ( 340, 0.6 ) ] )
	# small-scale relief of the bed: hummocks and hollows a few decimetres high, fading in the shallows
	fine_n = 0.25 * smooth_noise( xn, zn, 11, [ ( 23, 1.0 ), ( 9, 0.5 ) ] )
	near_profile = bed_depth( d_n, s0_n, dmax_n, mult_n )
	k_n = np.clip( ( d_n - 20 ) / 60, 0, 1 )
	depth_n = near_profile * ( 1 - k_n ) + up( lake_d ) * k_n + fine_n * np.clip( d_n / 25, 0, 1 )
	apply_shoals( depth_n, water_n, xn, zn, shoals )
	depth_n = np.maximum( depth_n, np.minimum( d_n * 0.02, 0.05 ) )
	near_h = np.where( water_n, LAKE_LEVEL - depth_n, hn )
	near_h = crop( near_h, near_g )

	# ---------------------------------------------------------------- far: the other lakes and ponds
	hf = raw[ 'far' ]
	t_far = far_g[ 'size' ] / far_g[ 'res' ]
	xf, zf = coords( far_g[ 'size' ], far_g[ 'res' ] )
	water_f = lake_mask( hf, far_g, 0.004, 0.08 )
	s0_f, dist_f = land_slope_at_shore( hf, water_f, t_far, 2 )
	d_f = np.maximum( dist_f * t_far - t_far * 0.5, 0 )
	dmax_f = np.clip( 3.0 + 0.032 * ndimage.gaussian_filter( dist_f * t_far, 300 / t_far ), 3.0, 27.0 )
	mult_f = 1 + 0.16 * smooth_noise( xf, zf, 7, [ ( 900, 1.0 ), ( 340, 0.6 ) ] )
	far_h = np.where( water_f, LAKE_LEVEL - bed_depth( d_f, np.clip( s0_f * 0.85, 0.025, 0.75 ), dmax_f, mult_f ), hf )

	# other water bodies: flat components (hydro-flattened) of at least ~6 ha, each at its own level
	rng_flat = ndimage.maximum_filter( hf, 3 ) - ndimage.minimum_filter( hf, 3 )
	flat = ( rng_flat < 0.004 ) & ~ ndimage.binary_dilation( water_f, iterations=2 )
	lab, n = ndimage.label( flat )
	bodies = [ { 'id': 1, 'name': 'Squam Lake', 'level': 0.0, 'elevation': LAKE_LEVEL } ]
	ids = np.zeros( hf.shape, np.uint8 )
	ids[ water_f ] = 1
	if n:
		sizes = ndimage.sum( np.ones_like( hf ), lab, index=np.arange( 1, n + 1 ) )
		boxes = ndimage.find_objects( lab )
		for k in np.argsort( - sizes ):
			if sizes[ k ] < 240 or len( bodies ) >= 250:
				break
			sl = boxes[ k ]
			j0, j1 = max( 0, sl[ 0 ].start - 3 ), min( hf.shape[ 0 ], sl[ 0 ].stop + 3 )
			i0, i1 = max( 0, sl[ 1 ].start - 3 ), min( hf.shape[ 1 ], sl[ 1 ].stop + 3 )
			sub = hf[ j0:j1, i0:i1 ]
			comp = lab[ j0:j1, i0:i1 ] == k + 1
			level = float( np.median( sub[ comp ] ) )
			surf = comp | ( ndimage.binary_dilation( comp ) & ( sub < level + 0.08 ) )
			sd = ndimage.distance_transform_edt( surf ) * t_far - t_far * 0.5
			dep = np.clip( 0.1 * sd, 0, np.clip( 2 + 0.02 * sd.max(), 2, 12 ) )
			far_h[ j0:j1, i0:i1 ] = np.where( surf, np.minimum( far_h[ j0:j1, i0:i1 ], level - dep ), far_h[ j0:j1, i0:i1 ] )
			bid = len( bodies ) + 1
			idsub = ids[ j0:j1, i0:i1 ]
			idsub[ surf & ( idsub == 0 ) ] = bid
			cj, ci = ndimage.center_of_mass( comp )
			bodies.append( { 'id': bid, 'level': round( level - LAKE_LEVEL, 3 ), 'elevation': round( level, 3 ),
				'area_km2': round( float( surf.sum() ) * t_far * t_far / 1e6, 3 ),
				'center': [ round( float( xf[ int( i0 + ci ) ] ) ), round( float( zf[ int( j0 + cj ) ] ) ) ] } )

	# ---------------------------------------------------------------- consistency between the grids
	mid_h = crop( mid_h, mid_g )
	f = int( mid_g[ 'size' ] / mid_g[ 'res' ] / ( near_g[ 'size' ] / near_g[ 'res' ] ) )
	o = int( ( mid_g[ 'size' ] / 2 - near_g[ 'size' ] / 2 ) / t_mid )
	nb = near_g[ 'res' ] // f
	mid_h[ o:o + nb, o:o + nb ] = block_mean( near_h, f )
	f2 = int( t_far / t_mid )
	o2 = int( ( far_g[ 'size' ] / 2 - mid_g[ 'size' ] / 2 ) / t_far )
	nb2 = mid_g[ 'res' ] // f2
	far_h[ o2:o2 + nb2, o2:o2 + nb2 ] = block_mean( mid_h, f2 )
	water_mid_f = block_mean( crop( water_m.astype( np.float64 ), mid_g ), f2 ) > 0.5
	ids[ o2:o2 + nb2, o2:o2 + nb2 ] = np.where( water_mid_f, 1, np.where( ids[ o2:o2 + nb2, o2:o2 + nb2 ] == 1, 0, ids[ o2:o2 + nb2, o2:o2 + nb2 ] ) )

	# water body map dilated two texels under the shore: the surface ends beneath the land, never short of it
	dil = ids.copy()
	for _ in range( 2 ):
		grown = ndimage.grey_dilation( dil, size=3 )
		dil = np.where( dil == 0, grown, dil )

	# ---------------------------------------------------------------- write
	os.makedirs( args.out, exist_ok=True )
	meta = {
		'about': 'Squam Lake, New Hampshire. Heights from USGS 3DEP (public domain); the lake bed is generated (see tools/terrain/build_terrain.py).',
		'reference': { 'lat': REF_LAT, 'lon': REF_LON, 'note': '43°46\'40.49"N 71°32\'30.87"W, transverse Mercator origin' },
		'center': { 'easting': CENTER[ 0 ], 'northing': CENTER[ 1 ] },
		'lakeLevel': LAKE_LEVEL,
		'axes': 'x east, z south, y up (m); y = 0 is the surface of Squam Lake',
		'encoding': { 'base': BASE, 'layout': 'uint16 little endian, deltas along each row, high byte plane then low byte plane, gzip' },
		'grids': {},
		'water': { 'file': 'water.bin.gz', 'res': far_g[ 'res' ], 'size': far_g[ 'size' ], 'bodies': bodies },
		'shoals': len( shoals ),
		'sources': { 'service': SERVICE, 'sha256': sources },
	}
	stats = {}
	for g, hh in ( ( near_g, near_h ), ( mid_g, mid_h ), ( far_g, far_h ) ):
		y = hh - LAKE_LEVEL
		blob, q = encode( y, g[ 'step' ] )
		with open( os.path.join( args.out, g[ 'name' ] + '.bin.gz' ), 'wb' ) as fo:
			fo.write( blob )
		err = np.abs( decode( q, g[ 'step' ] ) - y ).max()
		meta[ 'grids' ][ g[ 'name' ] ] = { 'file': g[ 'name' ] + '.bin.gz', 'size': g[ 'size' ], 'res': g[ 'res' ], 'step': g[ 'step' ],
			'min': round( float( y.min() ), 2 ), 'max': round( float( y.max() ), 2 ) }
		stats[ g[ 'name' ] ] = f'{ len( blob ) / 1e6:.2f} MB, y { y.min():.1f} .. { y.max():.1f}, max error { err:.4f}'
	with open( os.path.join( args.out, 'water.bin.gz' ), 'wb' ) as fo:
		fo.write( gzip.compress( dil.tobytes(), 9, mtime=0 ) )
	with open( os.path.join( args.out, 'terrain.json' ), 'w' ) as fo:
		json.dump( meta, fo, indent='\t' )
	for k, v in stats.items():
		print( k, v )
	for b in bodies:
		print( '  water body', b )
	print( 'water bodies', len( bodies ), 'lake texels (near)', int( crop( water_n, near_g ).sum() ), 'shoals', len( shoals ) )


if __name__ == '__main__':
	main()
