# Creative and technical decisions to review

Calls made while building toward the reference images (docs/REFERENCE.md) without the author at hand.
Each is easy to reverse; the file or setting is named.

## World and site

- **Where the village is.** On the south-facing slope above the cove on Squam's north shore, below
  Rattlesnake, about 0.5 km south-east of the given coordinate (which sits on the steep flank under the
  summit cliffs). The cove's head is the low ground for the green; the ravine coming down Rattlesnake to its
  west carries the stream. World origin and layout: `src/world/WorldLayout.js`, `src/world/settlement/Plan.js`.
- **Walkable area.** 2 km × 2 km at 1 m resolution around the village; beyond it the land is drawn from
  coarser grids (4 m, 16 m) to ~16 km in every direction, without plants or buildings.
- **Lake bed.** The lidar has no bathymetry, so the bed is generated: up to ~27 m deep in the open basin,
  steep off rocky points, shallow in coves, with ~400 submerged boulder shoals (Squam is known for them).
- **Season and time.** High summer (sun declination 15°, ~early August) at 43.8° N. Default time of day
  unchanged from Tidewater (16:12, warm afternoon light like the references).
- **No fishing game, no money.** Following the series bible: exploration only (walk, swim, the boat, fly).
  The fishing code stays in `src/game/` but is not loaded.

## The village (rebuilt 2026-10-23 from reference/home-v2.png and reference/neighborhood-v2.png)

- **The new references are the source of truth.** The author's second set of images replaced the first:
  free-standing rounded homes instead of vaults cut into the hill, and a village with no tall halls.
- **How the homes are modelled.** Each shell is a blend of soft shapes (body, roof shoulder, the open arch's
  barrel, the planted cap, the openings) written as distance functions (`HomeShape.js`) and meshed once at load
  with surface nets (`Sdf.js`; 18 cm cells, Mimi's 14 cm). This gives the painting's rounded, hand-plastered
  forms with no hand-built seams, and every home still varies and sits on its own terrace. Chosen over Blender
  (the author agreed). The shells are meshed in parallel Web Workers from the start of loading (`Shells.js`),
  so they are ready before the village is built; each home's shape comes from its own seed (its id).
- **Layout: clusters, not rows (2026-10-28, the author's request: "too orderly and geometric").** The homes
  stand in small groups with paths winding between them, rather than the painting's terraced rows: 46 homes
  in 15 clusters of one to five (plus six in the hamlet). Each cluster is a loose blob of homes round a little
  common with a shade tree where its paths meet, some above it and some below, each facing down the slope
  give or take ~15 degrees (a little toward the common when above it), all at the heights the hill gives them.
  Bigger clusters are 64 m apart or more; pairs and lone cottages fill some of the room between; groves of
  oak, maple and birch stand in the meadow between them so each group reads as its own. The paths are routed
  over the ground (cheapest route: gentle grades cheap, steep ones dear, houses, stream, pond and gardens in
  the way), each common and then each home's steps joining the nearest path already laid, so they branch like
  desire lines and turn to stairs where they climb. Laid out by `tools/layout/clusters.mjs` (seed 11; `--png=`
  draws the plan), written to `src/world/settlement/Layout.js`, which can be edited by hand. Mimi's house is
  pinned (`MIMI` in `Plan.js`). Homes are graded lowest first, so a terrace is never cut away by the ground dug
  round the roof of a home below it. Views: `cluster`, `clusterEast`, `upper`, `villageAerial`, `villageTop`.
- **Homes.** A long low body (12-18 m along the front, 8.5-10 m deep) of warm lime plaster with rounded ends,
  walls ~2.8-3.1 m swelling into a domed roof under a thick, lumpy planted cap that overhangs ~0.5 m like a lip
  (leaves, clover, small white and violet flowers; stems trail down the plaster below it). The back half is
  buried in the slope. About half the homes have the great open arch at one end (`loggia`): an outdoor kitchen
  under a vault ~6 m wide and 4 m high, open at the front and through a smaller arch in its end wall, with a
  domed oven glowing at the back, shelves of jars, a long table and chairs, two hung lanterns and a rain chain.
  The rest have a door and windows only. Every home: an arched plank door with small lights and iron rings, a
  wall lantern, arched windows and round windows deep in the wall, 1-2 oval skylights with timber spokes, a
  chimney pot, a pergola grown over with vines or a canvas awning over the front.
- **Mimi's house** (`MIMI`, id `mimi`; its details still drawn from its old id `A1b`) stands above the green,
  in the cluster nearest it: the largest (18 m, taller walls and a bigger
  arch, after the painting), a pergola over its door, the blue seam round the arch, and a kitchen garden at its
  west end (raised beds, bean poles with climbing vines, a woodshed stacked with logs, a rain barrel and a
  watering can, a stone trough, a rail fence). A few other homes have smaller gardens off one end
  (`garden` in `Layout.js`). View: `mimiHero`, `mimi`, `mimiArch`, `mimiGarden`.
- **Terraces.** Flagged, with rounded front corners, on a curved retaining wall of big pillowed sandstone
  blocks that rises into a low parapet where the drop is high; steps down from the door; lavender, shrubs and
  ferns along the foot of the wall; 2-4 rounded sandstone boulders bedded beside each terrace.
- **Glazing.** Windows still show a traced room behind the glass (vaulted plaster room, floor, rug, shelves,
  table, lamp). Real, walkable interiors are later work; the outdoor kitchens under the arches are walkable.
- **The blue seam.** On about a third of the homes: a pale breathing blue line round the great arch's face
  (as in the painting). `seam: true` per home.
- **The halls are gone** (author's call, 2026-10-23): the new neighbourhood image has none. The plaza went with
  them; the green now runs down to the shore.
- **The festival ground.** The green's lower half: four big open-grown oaks, six tall timber poles with strings
  of paper lanterns (red, orange, yellow, cream, teal, rose) and cloth pennants swagged between them and into
  the oaks, four long trestle tables with benches, jugs and bowls (`FESTIVAL` in `Plan.js`, `Festival.js`). The
  lanterns glow after dusk.
- **People.** ~34 people: twelve circles talking on the festival ground (one speaking at a time, the others
  listening, looking round, now and then shrugging) and three on the terraces of homes, who wave when you come
  up (Mimi is one, in her arch). They are Tidewater's two Rocketbox characters (Joe and Marta, MIT licence),
  copied, so the crowd repeats two faces and outfits; more Rocketbox characters would vary it. They don't walk
  or sit: the models carry only standing clips. Copies share textures and geometry; animated within 70 m.
  `?noPeople` leaves them out. The style is more realistic than the paintings: worth a look.
- **Paths and stairs.** The shore path, the path along the top of the green and the paths by the pond and
  gardens are laid by hand (`MANUAL_PATHS`); the rest are routed (`LANES`, see Layout above). Stone stairs
  wherever a path climbs steeper than ~1 in 7.
- **Chimney smoke.** A faint wisp from about one chimney in seven, always Mimi's (the painting has one). The
  bible rules out routine combustion; I read these as bread ovens and the odd hearth fire, not heating or
  power. Easy to remove (`smoke` per home, `Smoke.js`).
- **Lanterns up the stairs** on timber posts with an arm (the neighbourhood painting); low stone lamps stay
  along the longer walks.
- **Sky flowers.** The neighbourhood painting has tall white flowers on stems over the far hillside's trees.
  I read them as the village's solar collectors, grown rather than built: a pale plaster stem 30-38 m tall (the
  pines here are 25-30 m) with six cupped white petals opening to the sky, veined with the technology blue
  (faint by day, glowing at night). Four over the hamlet's point, three above the village's highest homes
  (`SKY_FLOWERS` in `Plan.js`, `SkyFlowers.js`). Their function is my guess; easy to recast or remove.
- **Stream and pond.** The stream drops ~45 m from the ravine to the cove through a lily pond (level 7.2 m);
  four timber footbridges. It steps down in pools over little falls (~0.5 m each), white water only at the
  lips, as in the neighbourhood painting. The pond and stream water are opaque, dark, reflective surfaces (not see-through).
- **Paths.** The village's walks are surfaced with crushed sandstone (pale and warm like the homes, as in the
  layout image) and about 2.5 m wide; trails in the woods stay worn earth; flagged stone along the lake shore,
  dressed stone steps wherever a path is steeper than ~1 in 7.

- **A hamlet across the water.** Six homes on the long point to the west, facing east toward the village (the
  layout image shows a second settlement on the far shore). `HAMLET` in `Plan.js`.
- **Small craft.** Two sailboats at anchor, a kayak in the cove, a rowboat at the dock (`BOATS`).
- **Gardens.** Five community plots of raised beds with rows of leafy crops (east of the green, west of it by
  the stream, and below the pond), three pergolas grown over with vines, a 12-tree apple orchard (`GARDENS`,
  `ORCHARD`), besides the homes' own kitchen gardens.
- **The lily pond** has rafts of pads (up to ~130) toward its quieter shore, and the meadow comes down to the
  water on all sides.
- **Evening light.** Low stone lamps with a warm glow line the longer walks (lit after dusk); the blue seams
  breathe; every arch glows amber at night. Path lamps are warm rather than blue: the reference's night panel
  has warm path lights, and the bible's blue is kept for the technology in the homes.
- **Where you start.** By the upper footbridge west of the village, looking down over the roofs to the green and the lake.

## Wildlife

- **Common loons**, the lake's signature bird (Squam is known for them): four pairs and two single birds,
  each with a home stretch of open water chosen from the lake bed (deep, well off the shore). They swim low,
  look about, peer under the surface, dive for 15-40 s and come up 25-90 m away; a mate dives with its
  partner and surfaces near it; now and then one rears up for a wing-flap. A boat or swimmer within ~28 m
  makes them dive and come up farther off. Every few minutes one of the singles runs ~40 m across the water
  to take off, flies to another bay at ~20-35 m and skids down onto the water. Breeding plumage: black head,
  striped necklace and throat bar, chequered back, red eye. `addLoons` in `src/world/wildlife/Birds.js`.
- **No island animals.** Tidewater's gulls, terns, pelicans, frigatebirds, sanderlings and crabs are left out
  (`lake: true` on `Wildlife`); with the loons present the soundscape's gull and tern calls fall silent.
- **No loon calls yet.** Tidewater's audio uses field recordings only, never synthesis, and I can't audition
  a recording from here; a public-domain wail / tremolo (US government recordings are) would be the single
  most evocative sound for the lake. Easy to add as a one-shot from the loons, like the gulls' calls.

## The woods and the planting

- **Forest mix.** Eastern white pine (shores, ledges, emergent), eastern hemlock (ravines, north slopes, by
  the water), maple, red oak, beech and paper birch; mountain laurel, hobblebush and lowbush blueberry; ferns.
  Placement rules: `src/world/vegetation/ForestScatter.js`.
- **The village clearing.** The homes stand among trees, as in the references: clumps and groves of
  open-grown red oaks and maples with broad, low crowns, birches in twos and threes, a few pines, glades of
  meadow between (`CLEARING` in `Plan.js`, rules in `ForestScatter.js`); trees keep ~4.5 m off the homes and
  the forest closes in at a ragged edge. The clearing now reaches the shore (the tall shore pines there made it
  look unlike the paintings' broadleaf lakeside). Few trees right among the homes (half the density within
  ~14 m of a home), more in the groves between the clusters (`GROVES` in `Layout.js`).
- **Designed vistas.** Corridors from the starting point down over the green to the cove are kept free of
  trees (`VISTAS` in `Plan.js`).
- **Fuller crowns.** Every broadleaf tree carries ~1.3x the leaf clusters it had in Tidewater (the crowns read
  as solid and rounded, like the references' trees); about +2 ms over the nine benchmark views together.
- **Open-grown pines keep their low limbs**; pines in the forest have shed their lower third.
- **The green.** Shaded as a dense mown lawn (fresh, even green to the ground, no tussocks, little relief)
  instead of tall-meadow sward, which made it read as dark olive carpet (`Terrain.setLawn`).
- **Ground flora.** Knee-high meadow grass on the roofs and in the clearing, a short mown lawn on the green,
  drifts of tall lupine (full spikes, blue-violet, some pink) and Queen Anne's lace (flat white umbels) through
  the meadows and crowding round the homes, daisies and clover in the lawn. About twice the flowering stalks of
  the first pass, which left the meadows looking bare against the references. Tidewater's tropical grass kinds were repurposed (dune grass → lawn, sea oats →
  lupines, beach creeper → daisies).
- **Vines** spill from the roof's lip, over the great arches and the pergolas, with small purple and white
  flowers; terracotta pots with shrubs and ferns by the doors and on the terraces.
- **Lavender.** The reference homes stand in drifts of it; the plant set had none, so the settlement grows its
  own clumps (`Lavender.js`) along the front walls, the terrace walls and the steps.
- **Boulders.** Rounded honey sandstone boulders by the homes (as in the painting, `HomeGarden.js`); granite
  erratics through the woods and the meadows, boulder-strewn shores, rounded stones round the pond and along
  the stream.

## Look

- **Plaster and stone.** The homes are warm cream-to-honey lime plaster (soft trowel clouds, a sanded grain,
  rain-darkening under the lip). The terrace walls are big pillowed sandstone blocks (~0.35-0.5 m courses,
  0.55-1 m long) with deep dark joints, honey and cream; steps, sills and thresholds are dressed sandstone.
- **Grade.** A little warmer and more saturated than Tidewater's (saturation 1.14, warmth 0.05, contrast 1.05)
  toward the references' warm summer afternoon (`src/post/PostFX.js`). Default time 16:30.
- **Lake.** Short wind chop (3.5 m/s over 3 km of fetch), wave heights scaled to 55 %, ripples lapping the
  shore instead of surf; clear water with a faint tea tint (absorption 0.46 / 0.10 / 0.12 per metre). The
  settings call the conditions Still / Light air / Breezy / Windy.
- **Key art** for the loading screen is a render of the village (`public/ui/keyart*.jpg`, view `keyart`).

## Still Tidewater (not yet adapted)

- The boat keeps Tidewater's lobster-boat hull and wheelhouse, refitted as an electric launch: no traps,
  hauler, bait, buoys or radar; teak benches with canvas cushions round the cockpit; silent (only the water along
  the hull). A boat designed for the world (a varnished launch or a small sailing boat) would be better.
- Songbirds still sing from Tidewater's samples (generic woodland birds; no New England species).
- The sound bed is Tidewater's (surf is near silent at the lake's wave height; the birds are generic).

## Performance

On this Mac (headless Chrome), 2560 x 1267: about 19-23 ms of GPU time per frame across the benchmark views
(the forest view is the heaviest); dynamic resolution takes it from there. The new homes left the total
unchanged (189.9 ms over the nine views, against 190.1 before); lavender, boulders, sky flowers, smoke and
the stair lanterns added ~2 % more (measured against the earlier commit in the same session, since the
machine's own timings drift by ~3 % between runs). The denser layout and the people added about 4 % more
(measured while the machine was heavily loaded by other work, so rough); the shells are 2.3M triangles.
Building the village (with the shells meshed ahead in workers) takes ~2.5 s of the load under that load.
Measure with `node tools/shots/shoot.mjs --bench`.
