# Experience Labels On The World Map

Why the hub's markers look the way they do, and the MapLibre rules that decided it. The
tile side of the map lives in [map-tiles.md](./map-tiles.md); this document is about the
names drawn _over_ those tiles.

## Two families of names, one frame

The home screen draws two kinds of text on the same map:

| Family           | Where it comes from                                                             | Can the walker open it          |
| ---------------- | ------------------------------------------------------------------------------- | ------------------------------- |
| Experience names | the experiences payload, `worldPointLabel` (`packages/shared/src/map/world.ts`) | yes, pressing it opens the card |
| Basemap names    | the published style's own layers (`landuse_label`, `places_*`)                  | no, they are context            |

The walker has to tell them apart at a glance, and the basemap cannot be silenced to help:
a barrio that is only named once you are standing in it is a name nobody reads. So the
experiences carry their own weight instead.

## What "their own weight" means

All of it lives in `buildReferenceStyleLayers` (`packages/shared/src/map/style.ts`), and
both renderers build from it, so web and native cannot drift.

| Piece      | Value                                                 | Why                                                                                      |
| ---------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Face       | `Noto Sans Medium`                                    | the basemap's names are Regular and Italic; the weight is the signal                     |
| Size       | 11 px at z13, 12 px at z15                            | one point down from where it started: on a phone the cluster was unreadable              |
| Halo       | 3 px                                                  | separates the name from whatever it sits on                                              |
| Dot        | radius 6 with a 2 px white stroke                     | deliberately the same as the detail map's, because the emphasis is the face, not the dot |
| Tap target | transparent circle, radius 16, `circle-opacity: 0.01` | a thumb covers about ten millimetres; the drawn dot covers five                          |

The tap target is its own layer (`refs:<key>:circle-hit`) drawn _before_ the dot so the
marker sits on top, and it keeps the document's own id: both renderers resolve a press by
asking which `refs:` layer was touched, so the wider target works without touching either
press handler.

`world-map.tsx` also gives the walker a labels toggle, so a crowded frame can be
decluttered without leaving the map.

## The four MapLibre rules this cost us

### 1. Culling is per layer

`text-allow-overlap: false` means "if this label cannot be placed without overlapping
another, do not draw it". A crowded frame is expected to drop the loser, and it drops it
silently.

### 2. An anchor names the side of the text that is pinned

`text-variable-anchor: ['left', …]` pins the **left** edge of the text to the point, so the
text grows to the **right**. `['right', …]` grows it to the **left**, and `['top', …]`
draws it above. Reading the value as "put the text on this side" is backwards, and doing so
sends names off the edge of the card.

### 3. The anchor list is a fallback chain, and it needs collisions

MapLibre tries each anchor in order and keeps the first that does not collide. Turn
collision detection off (`text-allow-overlap: true`) and it stops advancing: every name
lands on the first anchor and the sides are never tried at all. This is why the hub keeps
culling on despite wanting every name drawn.

### 4. The style cannot see the viewport

Symbols are placed in the world, not in the card. A name growing east from a point against
the east edge is drawn past the card and clipped, and no anchor order fixes both edges at
once: whatever helps the eastern points damages the western ones.

## The solution: the side is a datum

Because an anchor belongs to a layer and not to a feature, the side becomes data and the
style filters on it:

```
point in the last fifth of the frame  →  properties.labelSide = 'west'
layer  refs:<key>:label        filter: no labelSide   anchors: left, top, bottom, right
layer  refs:<key>:label-west   filter: labelSide west  anchors: right, top, bottom, left
```

`LABEL_WEST_FROM_FRAME_SHARE = 0.8` is four fifths of the way across on purpose: at a
narrower threshold the next point in also flips, and a name growing west from the middle of
the card lands on its neighbours. Only the point genuinely against the right edge flips.

Every other caller — the detail map, an itinerary — keeps one label layer and the filter it
always had. The classic movable order stays `left, right, top, bottom`, because that crowd
runs along a road where a label beside its point is the unambiguous one.

## The measurement that explains the north cluster

Three experiences at the north of the world sit **137 and 204 metres** apart, which on a
340 dp card is **19 and 28 pixels**. A single-line label is about 16 pixels tall, and
culling needs room around each one:

```
3 labels × ~20 px  = 60 px needed
band available     = 47 px
```

Three two-line labels needed about 96 px of that 47 px band, which is why one name always
vanished and which one depended on draw order. Keeping a title on one line
(`BOLD_TEXT_MAX_WIDTH = 20` em) is what made all of them fit.

## The root cause is the data, not the style

That cluster is not geography. The staging seed's coordinates were traced from the pins of a
hand-drawn illustration (see #604), so three experiences that are far apart in reality sit a
few hundred metres from each other here.

Every number above is tuned against that data. **With real coordinates the cluster separates
on its own and most of this tuning becomes unnecessary.** The style is correct, but it is
compensating for a payload that describes a drawing.

## Where each piece lives

| Concern                                                                  | File                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| Weight, size, halo, dot, tap target, anchor orders, the two label layers | `packages/shared/src/map/style.ts`                      |
| Which point is "east", and the opening frame's margins                   | `packages/shared/src/map/world.ts`                      |
| Native camera padding around the fit                                     | `apps/mobile/src/components/map/experience-map.tsx`     |
| The labels toggle and `boldReferences` for the hub                       | `apps/mobile/src/components/map/world-map.tsx`          |
| Web overlay re-application                                               | `apps/mobile/src/components/map/experience-map.web.tsx` |

## How to check it

- `cd packages/shared && bunx vitest run` — the layer numbers, the anchor orders, and the
  two-layer split are pinned in `map-label-hierarchy.test.ts` and `map.test.ts`, including a
  test that a caller who does not ask for the hub's weight gets today's four layers
  unchanged.
- `cd apps/mobile && bunx jest --ci "src/.*(map|experience-map|world-map)"` — both renderers
  draw the same marker numbers and the press works on the hit circle.
- A phone is still the only place that settles how a 12 px `Medium` name reads over the real
  archive, and whether a radius-16 transparent target is really hit by a thumb. The opacity
  is the knob if a device swallows the tap.
