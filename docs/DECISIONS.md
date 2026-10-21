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

- **Size.** 26 earth homes (24 houses and two small vaults by the halls) in three rows on the north hillside
  (A), two west of the stream, three short rows on the east hillside (B). The layout image shows more homes;
  this is a first neighbourhood, easy to extend in `Plan.js`.
- **Homes.** One main arch (7–9 m span, ~4 m rise) with up to two smaller side arches; vault 8.5–10 m deep
  into the hill; a flagged terrace 4–5 m deep; 1–3 oval skylights in the planted roof. Floors are set ~0.45 m
  below the natural ground so terraces need little fill (lower retaining walls).
- **Glazing.** Opaque (no interiors yet), painted as a warm, lived-in room that glows softly by day and
  brightly after dusk. Main arches have glazed double doors; side arches have windows over a low sill wall.
- **The blue seam.** Every third home or so has the pale breathing blue line round its door arch (bible:
  everyday technology shown quietly). `seam: true` per home in `Plan.js`.
- **The halls.** Three tall catenary "teardrop" halls (25 m, 20 m, 16.5 m) between the green and the cove,
  with tall framed great windows facing the green and the water, and flagged aprons. Their function is not
  decided (the earlier plan doc said to keep them as proposals).
- **Stone.** One warm sandstone family (cream, honey, pale) for homes and halls; granite for boulders.
- **Stream and pond.** The stream drops ~45 m from the ravine to the cove through a lily pond (level 7.2 m);
  four timber footbridges. The pond and stream water are opaque, dark, reflective surfaces (not see-through).
- **Paths.** Worn earth paths on the terrain, flagged stone along the lake shore, dressed stone steps
  wherever a path is steeper than ~1 in 7.

- **A hamlet across the water.** Six homes on the long point to the west, facing east toward the village (the
  layout image shows a second settlement on the far shore). `HAMLET` in `Plan.js`.
- **Small craft.** Two sailboats at anchor, a kayak in the cove, a rowboat at the dock (`BOATS`).
- **Gardens.** Raised beds with rows of leafy crops, two pergolas grown over with vines, a 12-tree apple orchard
  beside them (`ORCHARD`).
- **Evening light.** Low stone lamps with a warm glow line the longer walks (lit after dusk); the blue seams
  breathe; every arch glows amber at night. Path lamps are warm rather than blue: the reference's night panel
  has warm path lights, and the bible's blue is kept for the technology in the homes.
- **Where you start.** On the path above the first rows, looking down over the roofs to the halls and the lake.

## The woods and the planting

- **Forest mix.** Eastern white pine (shores, ledges, emergent), eastern hemlock (ravines, north slopes, by
  the water), maple, red oak, beech and paper birch; mountain laurel, hobblebush and lowbush blueberry; ferns.
  Placement rules: `src/world/vegetation/ForestScatter.js`.
- **The village clearing.** The homes stand in an open meadow (`CLEARING` in `Plan.js`) with scattered birches,
  pines and oaks, as in the references; the forest closes in at a ragged edge.
- **Open-grown pines keep their low limbs**; pines in the forest have shed their lower third.
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
- No wildlife yet (the gulls, crabs and the whale were island animals): loons would be the obvious first.
- The sound bed is Tidewater's (surf is near silent at the lake's wave height; the birds are generic).

## Performance

On this Mac (headless Chrome), 2560 x 1267: about 18-22 ms of GPU time per frame across the benchmark views
(the forest view is the heaviest, 6.5 ms for the opaque pass); dynamic resolution takes it from there.
Measure with `node tools/shots/shoot.mjs --bench`.
