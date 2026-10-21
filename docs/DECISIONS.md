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
