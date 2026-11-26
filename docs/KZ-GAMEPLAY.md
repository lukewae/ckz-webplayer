# KZ gameplay follow-up — 10 October 2026

The user reported that the latest bhop/longjump measurements feel close to their native experience, then requested an advanced checkpoint menu, real timer zones and camera-directed noclip.

## Why the start/finish looked like bumps

Inspection of the compiled map identified two render meshes:

| Marker | Source bounds |
|---|---|
| `gradient_start` | X 256; Y 2880–3104; Z 2160–2168 |
| `gradient_end` | X 48–240; Y -2467; Z 1792–1802 |

These are vertical sheets, 8/10 units high. Their actual `materials/gamechaos/gradient_*.vmat_c` materials enable **F_ADDITIVE_BLEND**, **F_TRANSLUCENT**, **F_RENDER_BACKFACES** and self illumination. The original tint is green for start and red for finish. The blueish finish in the initial viewer was the generic fallback material. Replacing both with opaque `MeshStandardMaterial` made the visual effects look like solid obstacles.

Separately, `physics_window` contained precisely their four triangles. The initial importer included those as player collision, making them actual obstacles in this prototype. The importer now excludes window-tagged faces only when they match the identified marker sheets. The rest of the native world/brush collision is retained. Short hull traces across both real marker locations now complete unobstructed. The render meshes keep their authored placement and UVs, with the original gradient texture, additive blending, transparency and disabled depth writes.

## Timer identification

The world declares `timer_mapping_api_version=2`. Entity 27912 is `trigger_multiple`, type **5 (start)**; entity 6272 is type **6 (end)**. Both refer to `maincourse`, resolved to `[PR#]maincourse`, a course descriptor named Main. Their native convex planes are exported to `gameplay.json`. The timer does not infer zones from material names or colors. Reference: pinned CS2KZ `src/kz/mappingapi/kz_mappingapi.h` and `src/kz/trigger/callbacks.cpp`.

The local timer requires grounded start-zone contact, starts on exit and stops on finish entry for the same course. It uses swept player-hull overlaps, merging overlapping hull intervals. Noclip cancels timing. Checkpoint teleports count toward the attempt; pause freezes simulation and labels the attempt as practice. This is not authoritative native/server timing.

## Checkpoint menu

Classic numbered actions: checkpoint, teleport, previous, next, undo, pause, restart, options, noclip and close. M toggles the menu. Position, view angles, crouch and ladder contact are saved; velocity and prestrafe history are reset on teleport. Checkpoint history remains available when navigating backward and clears at start-zone entry/exit. Undo restores the pre-teleport location, requiring that the teleport originated on ground/ladder. Checkpoint placement/pause require ground or ladder contact. Full server anti-checkpoint, bhop-trigger and moving-platform restrictions remain out of scope.

Behavioral references: [KZTimer advanced-menu commands](https://github.com/klyve/KZTimerGlobal/blob/master/README.md), and the pinned [CS2KZ checkpoint implementation](https://github.com/KZGlobalTeam/cs2kz-metamod/blob/3848adea4644bc080bfec42441b864f3c4d99acc/src/kz/checkpoint/kz_checkpoint.cpp). No KZTimer source was copied.

## Portability

Explicit mapping API metadata gives a reusable basis for start/end recognition. The selected map's marker materials and entity-export correspondence are still audited assumptions. There is no claim that all maps use these gradient assets or that every window-tagged surface is nonsolid. Another map should be audited rather than silently generalized.
