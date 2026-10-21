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

## The village

- **Size.** 36 earth homes (34 houses and two small vaults by the halls): four rows on the north hillside (A),
  three west of the stream, four short rows on the east hillside (B), with six more in the hamlet across the
  water. The layout image packs in more; easy to extend in `Plan.js`.
- **Homes.** One main arch (7–9 m span, ~4 m rise) with up to two smaller side arches; vault 8.5–10 m deep
  into the hill; a flagged terrace 4–5 m deep; 1–3 oval skylights in the planted roof. Floors are set ~0.45 m
  below the natural ground so terraces need little fill (lower retaining walls).
- **Glazing.** Clear glass with a room behind it: each arch shows its vaulted interior, traced in the glazing
  shader (no geometry): warm plaster vault with faint stone ribs, a plank floor and a rug, shelves of books or a
  doorway at the back, a table and chairs and a potted plant, a pendant lamp under the crown. Daylight falls
  off toward the back; after dusk the lamp lights it. Main arches have glazed double doors; side arches have
  windows over a low sill wall. (Real interiors, walkable, are later work.)
- **The blue seam.** Every third home or so has the pale breathing blue line round its door arch (bible:
  everyday technology shown quietly). `seam: true` per home in `Plan.js`.
- **The halls.** Three tall catenary "teardrop" halls (25 m, 20 m, 16.5 m) between the green and the cove,
  with tall framed great windows facing the green and the water, and flagged aprons. Their function is not
  decided (the earlier plan doc said to keep them as proposals).
- **Stone.** One warm sandstone family (cream, honey, pale) for homes and halls; granite for boulders.
- **Stream and pond.** The stream drops ~45 m from the ravine to the cove through a lily pond (level 7.2 m);
  four timber footbridges. The pond and stream water are opaque, dark, reflective surfaces (not see-through).
- **Paths.** The village's walks are surfaced with crushed sandstone (pale and warm like the homes, as in the
  layout image) and about 2.5 m wide; trails in the woods stay worn earth; flagged stone along the lake shore,
  dressed stone steps wherever a path is steeper than ~1 in 7.

- **A hamlet across the water.** Six homes on the long point to the west, facing east toward the village (the
  layout image shows a second settlement on the far shore). `HAMLET` in `Plan.js`.
- **Small craft.** Two sailboats at anchor, a kayak in the cove, a rowboat at the dock (`BOATS`).
- **Gardens.** Five plots of raised beds with rows of leafy crops (east of the halls, west of them by the stream,
  and below the pond), three pergolas grown over with vines, a 12-tree apple orchard (`GARDENS`, `ORCHARD`).
- **The lily pond** has rafts of pads (up to ~130) toward its quieter shore, and the meadow comes down to the
  water on all sides.
- **Evening light.** Low stone lamps with a warm glow line the longer walks (lit after dusk); the blue seams
  breathe; every arch glows amber at night. Path lamps are warm rather than blue: the reference's night panel
  has warm path lights, and the bible's blue is kept for the technology in the homes.
- **Where you start.** On the path above the first rows, looking down over the roofs to the halls and the lake.

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
- **The village clearing.** The homes stand among trees, as in the layout image: clumps and groves of
  open-grown red oaks and maples with broad, low crowns, birches in twos and threes, a few pines, glades of
  meadow between (`CLEARING` in `Plan.js`, rules in `ForestScatter.js`); trees keep ~4.5 m off the homes and
  the forest closes in at a ragged edge. The mown green stays open but for its edges.
- **Designed vistas.** Corridors from the starting point down to each hall are kept free of trees, so the
  opening view (and the loading-screen key art) shows all three halls (`VISTAS` in `Plan.js`).
- **Fuller crowns.** Every broadleaf tree carries ~1.3x the leaf clusters it had in Tidewater (the crowns read
  as solid and rounded, like the references' trees); about +2 ms over the nine benchmark views together.
- **Open-grown pines keep their low limbs**; pines in the forest have shed their lower third.
- **The green.** Shaded as a dense mown lawn (fresh, even green to the ground, no tussocks, little relief)
  instead of tall-meadow sward, which made it read as dark olive carpet (`Terrain.setLawn`).
- **Ground flora.** Knee-high meadow grass on the roofs and in the clearing, a short mown lawn on the green,
  drifts of lupine (purple-blue, some pink and white) through the meadows and crowding round the homes, daisies
  and clover in the lawn. Tidewater's tropical grass kinds were repurposed (dune grass → lawn, sea oats →
  lupines, beach creeper → daisies).
- **Vines** spill over the arch crowns and wall tops, with small purple and white flowers; terracotta pots
  with shrubs and ferns on the terraces, shrubs and ferns along the foot of each terrace wall.
- **Boulders.** Granite erratics through the woods and the meadows, boulder-strewn shores, rounded stones
  round the pond and along the stream.

## Look

- **Stone.** Warm cream and honey sandstone with soft joints; the headwall tops are a slim stone coping with
  turf running back into the roof meadow (so from above the homes read as green mounds).
- **Grade.** A little warmer and more saturated than Tidewater's (saturation 1.14, warmth 0.05, contrast 1.05)
  toward the references' warm summer afternoon (`src/post/PostFX.js`). Default time 16:30.
- **Lake.** Short wind chop (3.5 m/s over 3 km of fetch), wave heights scaled to 55 %, ripples lapping the
  shore instead of surf; clear water with a faint tea tint (absorption 0.46 / 0.10 / 0.12 per metre). The
  settings call the conditions Still / Light air / Breezy / Windy.
- **Key art** for the loading screen is a render of the village (`public/ui/keyart*.jpg`, view `keyart`).

## Still Tidewater (not yet adapted)

- The boat is Tidewater's diesel fishing boat; the bible would want something quieter (sail or electric).
- Songbirds still sing from Tidewater's samples (generic woodland birds; no New England species).
- The sound bed is Tidewater's (surf is near silent at the lake's wave height; the birds are generic).

## Known issues

- Reference shots taken in one batch can show a haze of dark specks in the sky in a view that follows another
  (most after an aerial view); single views are clean, and the running game has not shown it. Cause not yet
  found (not the wildlife, haze or spray). The README screenshots are shot one batch per aerial view.

## Performance

On this Mac (headless Chrome), 2560 x 1267: about 18-22 ms of GPU time per frame across the benchmark views
(the forest view is the heaviest, 6.5 ms for the opaque pass); dynamic resolution takes it from there.
Measure with `node tools/shots/shoot.mjs --bench`.
