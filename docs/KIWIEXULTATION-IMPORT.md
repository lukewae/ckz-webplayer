# kz_kiwiexultation import — 13 October 2026

Imported [Workshop 3551310998](https://steamcommunity.com/sharedfiles/filedetails/?id=3551310998) with the pinned Source 2 Viewer 20.0.6980 pipeline after Steam completed the download. The map card uses **Kiwi**, **tier 7 · Extreme**, and no port-credit field, as requested. The Workshop description credits qennu for the CS2 port; asset ownership remains with the original authors/Valve. There is no CS2KZ listing or approval claim. Tier 7 is the requested local rating in both menu modes; no separate Vanilla rating was supplied.

The map is registered for local ranked CKZ and standard 64-tick VNL submissions, with separate Pro/TP records and replays through the existing server. Ranking does not depend on a CS2KZ page. The local development server was restarted and its live catalog and CKZ leaderboard endpoint recognize the map. No test records were added to the real database.

## Native resource audit

The outer directory/chunk package contains the verified internal `maps/kz_kiwiexultation.vpk`. Package MD5 is `0bff4f40e5ec6e912d7be324b7d3a457`; internal-map MD5 is `211b56fd7eb4f8cb341f64c0529c0775`. Full manifest hashes are retained in [kiwiexultation-provenance.json](kiwiexultation-provenance.json).

| Export | Result |
| --- | --- |
| Native collision | 21,764 triangles |
| Ladder collision | 337 triangles, included in the collision count |
| Native player spawn | `[1838.969971, 1704.77002, 2049]`, yaw 0 |
| Mapping API | Version 2 |
| Main course | `course_kiwi_main` |
| Timer start / end entities | 2131 / 382 |
| Authored restart | `[2128, 3056, 3181]`, yaw 315 |
| Transport volumes | 17 ordinary, 47 multi-bhop, 31 single-bhop |
| Authored splits/stages | None; `splits.json` is empty |
| Textured scene | 52 materials, 69 PNGs; approximately 7.2 MB of textures |

Entity physics correspondence was checked by classname and native origin. All 133 `func_brush` entities author solidity 1 (never solid), so their render decoration contributes no player collision. Native playerclip, combined npcclip/playerclip and ladder groups remain included; ordinary window/glass collision is preserved. No render meshes or bounding boxes substitute for native collision or trigger geometry. All exported timer/transport hulls are checked against the corresponding transformed physics vertices. Teleports use authored destinations, delays, speed resets and view angles.

The geometry, visual assets and cache are isolated under `public/maps/3551310998/` and `.map-work/3551310998/`. Geometry preparation is followed by the texture pass and split export. The texture pass checks internal SHA-256 and package MD5 against the prepared revision and never rewrites physics or timers.

## Previous import fixes applied

The existing material pipeline preserves Workshop material resolution, native overlay blending and alpha, and disables uncalibrated imported lights. This map's `graffiti_venice_05` color alpha was restored from its native texture. The exact converter-added overlay displacement was removed from one position accessor (six vertices); renderer polygon depth bias handles coplanar placement. Raw export and adapted public GLB hashes remain separate for cache reuse. The map has no foliage shader or fancy-water material requiring those special visual adaptations.

The existing context transport implementation includes the prior noclip/checkpoint contact-reset fixes. Movement constants and input handling were not changed for this import.

## Verification and limits

The map integration fixture verifies collision hash/size, grounding at its authored spawn, start/exit/finish timer contact for the Main course, course references, and every local texture dependency. A dedicated ranked-map regression stores CKZ/VNL Pro/TP records in an in-memory database, confirming all four remain separate. The full suite passed 149 tests before that regression was added; the updated leaderboard suite passed all five tests. The production build passed with the existing bundle-size advisory.

Browser checks loaded the textured scene, entered play, observed grounded native spawn state, verified the searched map card's Kiwi/tier 7 text, and found no missing map resources or page errors. Screenshots are `.map-work/3551310998/menu-preview.png` and `game-preview.png`. A complete expert playthrough was not performed.

Native restrictions remain outside the current engine: The type-1 checkpoint/pause modifier (entity 1873) remains diagnostic; all 23 type-4 anti-bhop volumes are supported. The enabled horizontal `trigger_push` entity 1866 (speed 40, origin `[3348,1424,3444]`) is not simulated. This import therefore does not establish every native route mechanic. Native lighting/lightmaps, full Source 2 shader effects, skybox composition and general entity I/O remain approximate or unsupported. The pinned converter reports the previously documented VCS 72 shader-metadata warnings; those do not indicate missing PNG dependencies.

## Reproduce

```powershell
npm.cmd run map:prepare -- --workshop-id 3551310998
npm.cmd run map:assets -- --workshop-id 3551310998
npm.cmd run map:splits -- --workshop-id 3551310998
```

For the verified cached revision, geometry supports `--reuse-exports`. After geometry preparation recreates the manifest, run the normal asset pass again. Use `--reuse-render` only when the current manifest already identifies a completed matching textured export. Restart the backend after changing its registry. Prepared runtime assets follow the repository's existing Git LFS rules; caches remain ignored.

## Bhop and sign correction (16 October 2026)

The importer now applies the pinned CS2KZ minimum 0.1-second grace period to type 11–13 bhop triggers, even when the map authors a zero delay. Blue type-11 blocks permit repeated timely hops; red type-12 blocks reject repeat landings. All 23 type-4 anti-bhop volumes now export their native hulls and individual timer_anti_bhop_time values (including zero for no-jump blocks): jump requests are suppressed while airborne within the volume or during the initial grounded interval. Normal friction handles speed loss; no synthetic collision or downward impulse is added.

The texture adapter reads native unlit sign blend modes and restores their color alpha. Packaged unlit materials take precedence over stale exporter material metadata (notably badges/1). Existing overlay displacement correction remains in place, and collision is unchanged.

Restart correction: the authored `[2128,3056,3181]` intersects a wall with the browser player hull. The map-specific restart is `[2140,3040,3181]`, 20 units toward the open edge; the authored start trigger remains unchanged. A real-collision simulation regression verifies no-jump block 1880 rejects a jump, and the revised restart is unobstructed, supported and inside the start zone.
