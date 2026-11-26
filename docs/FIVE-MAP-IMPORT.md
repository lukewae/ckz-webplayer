# Five Workshop maps — 11 October 2026

## 12 October: displaced overlays

After alpha restoration, the user identified decals floating above ramps, walls and Serfdom's shelter. This was a physical offset added by the pinned converter, not a texture UV shift. `GltfModelExporter.Mesh.cs` defines `OverlayNormalOffsetDistance = 0.01f / 0.0254f` and adds it along vertex normals after `BakePositions` converts positions to metres. The resulting 0.393700778 metres becomes approximately **15.50003 Source units** in this viewer. The previous follow-up retained that offset; this correction supersedes that decision.

`correctOverlayPositions()` in `scripts/material-adaptation.mjs` now removes exactly that converter-added local-space normal displacement from overlay position accessors, updating their bounds. It recognizes the converter's full overlay predicate: `F_OVERLAY`, `F_DEPTHBIAS`, `F_DEPTH_BIAS`, static-overlay shaders and `citadel_overlay.vfx`. Shared accessors are processed once; conflicting normals or sharing with ordinary geometry are rejected. A metadata marker rejects accidental double correction. Original node placement, normals, UVs, indices, texture alpha and authored decal positions are retained. Raw converter caches remain unchanged.

The viewer uses negative polygon depth bias (`factor=-1`, `units=-1`) to avoid coplanar flickering, rather than physically moving the decals. Native no-depth-write behavior is retained. Public assets were corrected for **Divert (11 accessors / 69 vertices), Serfdom (28 / 2,014), Grotto (20 / 607), Outback (9 / 476)**. Dydanhomon, Faded and Phamous have no affected overlays and were left untouched. `manifest.overlayOffsetCorrection` records the removed amount and counts; the adapted GLB hash was refreshed. Collision/ladder binaries, triggers, movement rules and the console were not changed.

The pipeline applies this correction on every future asset pass from the verified raw cache. Material fixtures now compare every binary byte against the expected position-only correction, retaining all ordinary geometry and other vertex channels. A synthetic fixture covers shared primitives, unchanged node transforms and double-correction rejection. Close-up browser audits check the resulting decal scenes.

## Follow-up: opaque decal rectangles

User screenshots showed black sheets on Outback/Serfdom slides and Grotto walls, plus an opaque hay sheet at Serfdom's wooden shelter. They are authored, noncolliding overlays. Two exporter problems combined: `GltfModelExporter.Material.cs` only derives alpha mode from `F_TRANSLUCENT`/`F_ALPHA_TEST`, ignoring the static-overlay `F_BLEND_MODE` enum; fallback image adaptation also removes native alpha. The earlier restoration pass only covered MASK materials. The original slide map has no affected static-overlay materials.

`scripts/material-adaptation.mjs` now preserves native static-overlay modes 1 (alpha blend) and 2 (alpha test), including the authored cutoff. Unlit overlays use `KHR_materials_unlit`. The asset pass restores native color alpha for translucent `F_OVERLAY` materials too, including Serfdom's `infhay`, and marks overlays with `extras.nativeOverlay`. The viewer disables their depth writes while retaining depth testing, matching pinned VRF `RenderMaterial.cs` lines 824–826. The exporter's existing normal offset is retained; no extra geometry lift or collision is invented.

Outback, Serfdom and Grotto were rebuilt from verified caches. Native PNG alpha ranges 0–255 were verified for representative markings, Grotto's cutout and Serfdom's hay. Geometry BIN chunks are byte-identical to the exporter output. Collision, ladders, triggers, movement and the developer console were not edited. Per the user's clarification, the wooden shelter's collision is left exactly as authored.

The material tests cover blend/cutout modes, output hashes, unchanged binary geometry and rejection of unaudited modes. Browser checks inspect actual material states and close-up views of the affected decals; screenshots and audits are `.map-work/<id>/decal-*.png` and `decal-browser-audit.json`. The rebuild passes 100 tests and the production build.

`manifest.texturedExportSha256` identifies the unchanged raw converter cache for `--reuse-render`; `texturedRenderSha256` identifies the adapted public GLB. Older manifests still use their existing cache hash until the next asset pass. Texture hashes remain in `asset-report.json`.

Imported using Astra's workflow in `AGENT-HANDOFF.md`, `DIVERT-IMPORT.md` and `TEXTURES-AND-IMPORT-REVIEW.md`, with the existing pinned Source 2 Viewer 20.0.6980. Installed Steam Workshop packages supply native world physics, entities, render scenes and materials. Each map has independent `public/maps/<id>/` outputs and `.map-work/<id>/` caches. Existing maps were retained.

| Map / Workshop | Collision triangles | Ladder triangles | Courses | Authored splits | Materials / images |
|---|---:|---:|---|---:|---:|
| [kz_faded](https://steamcommunity.com/sharedfiles/filedetails/?id=3366047597) | 10,710 | 0 | Main | 0 | 38 / 75 |
| [kz_serfdom](https://steamcommunity.com/sharedfiles/filedetails/?id=3162361624) | 63,168 | 60 | Main | 0 | 155 / 312 |
| [kz_grotto](https://steamcommunity.com/sharedfiles/filedetails/?id=3121168339) | 424,789 | 166 | Main, Garden, word's backyard, Old grotto (hard) | 0 | 190 / 378 |
| [kz_outback](https://steamcommunity.com/sharedfiles/filedetails/?id=3571933172) | 71,676 | 108 | Main | 4 | 75 / 111 |
| [kz_phamous](https://steamcommunity.com/sharedfiles/filedetails/?id=3104579274) | 6,305 | 64 | Main | 9 | 62 / 56 |

## Import details

`scripts/map-profiles.mjs` owns the audited Workshop identity registry. Browser browsing and server leaderboards include all seven maps. Workshop thumbnails are under `public/ui/workshop/`. Phamous uses a single outer `.vpk`; other packages use directory/chunk archives. Extra skybox/bake packages are distinguished from the playable world.

New exports match entity physics groups by classname and native origin, allowing several groups per entity. Native plane hulls are transformed and checked against exported physics vertices. Faded also has concave PHYS mesh triggers: a closed, consistently wound, star-shaped native mesh is decomposed into tetrahedra around its verified kernel. Open or non-star-shaped meshes are rejected. Render decoration and bounding boxes are never substituted for trigger geometry.

Enabled solid brushes and fixed solid dynamic props contribute only exported native physics triangles. Never-solid brushes and water volumes do not become walls. Faded's fixed shrubs retain native collision; Grotto's water volumes are omitted from solid collision. Duplicate water origins are handled without assuming global one-group-per-entity ordering.

All five use the context transport implementation. Timer zones, filtered contexts and existing timed bhop block behavior are retained. Native KZ relative teleport offsets, preserve-speed and keep-view options are honored. Legacy `trigger_teleport` destinations use the authored target and audited one-unit destination lift. Phamous authors no dedicated course restart destination: the existing reset fallback uses its real player spawn. No movement constants, console behavior or HUD styling were changed.

The separate asset pass resolves Workshop, CS2 and core materials, retains exported transparency and restores native color alpha for cutouts. Grotto's `csgo_environment.vfx` gate uses `g_tColor1`; that explicit shader-specific mapping is supported alongside `g_tColor`. Textured GLBs and all referenced PNGs are copied together. Each map's `manifest.json` and `asset-report.json` record provenance and texture hashes.

## Reproduce

Visual review also found that CS2 foliage stores wind/AO parameters in `COLOR`, which generic glTF shading interprets as albedo tint. New manifests opt into `nativeFoliageVertexData`; the viewer disables vertex tint for `csgo_foliage.vfx` materials only. This removes pink/black foliage without altering texture alpha, collision or original map rendering. Audited against pinned VRF `complex.vert.slang` lines 66–72 and 355–365. Wind animation and native foliage AO are still not reproduced.

After Steam finishes the download, substitute the selected Workshop ID:

```powershell
npm.cmd run map:prepare -- --workshop-id 3366047597
npm.cmd run map:assets -- --workshop-id 3366047597
npm.cmd run map:splits -- --workshop-id 3366047597
```

`--reuse-exports` rebuilds geometry metadata from verified cached exports. `--reuse-render` requires the textured manifest's matching cache hash; it is for a completed asset export, not recovery from a failed first pass. `npm.cmd run map:splits` refreshes all installed registered maps. Restart the server after changing its map registry.

## Limits and verification

Fancy water exports as a featureless white surface because its native shader has no glTF equivalent. Faded/Grotto enable `nativeWaterPreview`, a static translucent approximation using the authored `g_vWaterDecayColor` and roughness. The preview uses 50% opacity for visibility; it does not reproduce depth-dependent absorption, reflections, refraction, waves or water physics.

These imports use the existing browser prototype. Native lightmaps, full animated/blended shaders and separate 3D skybox composition remain approximate or unsupported. Moving props/brushes, swimming, general entity I/O, anti-bhop restrictions and checkpoint/pause modifiers remain unsupported. Split volumes feed the existing results/PB display; they do not implement every native stage rule. Grotto is substantially larger and can require more loading time and GPU memory.

`tests/additional-maps.test.ts` checks identity, collision hashes, native spawn landing, start/end contact for every course, split-course references and texture resolution. Contact fixtures derive an interior point from actual planes; entity origins need not be inside their volumes. Separate fixtures cover relative teleport options and a concave trigger's cutout.

The five-map browser smoke check passed: all textured scenes loaded, the player entered each map and grounded at its native spawn, with no missing map resources or page errors. Preview images are `.map-work/<id>/menu-preview.png` and `game-preview.png`. This does not claim complete human playthroughs of all courses.
