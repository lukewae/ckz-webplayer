# CS:GO VNL first pass — 12 October 2026

Choose **Movement → VNL** in the main menu. CKZ remains the default. Changing mode, timing or air acceleration reloads the map so a run cannot cross configurations. The selection is carried in the URL and retained when switching maps.

## Timing

| Option | Commands / second | Movement steps / second | Angles |
| --- | ---: | ---: | --- |
| 64 tick (default) | 64 | 64 | One sampled command angle per step |
| 128 tick | 128 | 128 | One sampled command angle per step |
| 64 commands / 128 steps | 64 | 128 | Existing midpoint/final angle interpolation |

The third option is explicitly a browser compatibility variant, not native CS:GO 64-tick or vanilla CS2 subtick parity. The first two simulate different discrete trajectories; they are not expected to produce identical jump heights. Rendering interpolation remains separate. Input still comes from browser digital keys and timestamped mouse events, not a native client usercmd generator.

## Baseline and evidence

The target is legacy CS:GO, with a **250 u/s knife-speed assumption**, manual jumping, ordinary surface friction and no weapon/combat system. This is not CS2KZ's modern VNL profile. The CS2 map import pipeline is unchanged.

Behavioural references were inspected, not copied verbatim:

- [Kisak-Strike CS movement](https://github.com/SwagSoftware/Kisak-Strike/blob/master/game/shared/cstrike15/cs_gamemovement.cpp): stamina, jump restriction/order, duck spam, speed cropping and knife-equivalent ground acceleration.
- [Shared movement](https://github.com/SwagSoftware/Kisak-Strike/blob/master/game/shared/gamemovement.cpp): gravity order, walk speed cropping, categorization and ladder projection.
- [Movement cvars](https://github.com/SwagSoftware/Kisak-Strike/blob/master/game/shared/movevars_shared.cpp): baseline coefficients.

These are a community-hosted legacy CS:GO source reference, not a certification against a particular installed Valve binary. Downloaded source snapshots in `.map-work/` were pinned by SHA-256:

| Local reference | SHA-256 |
| --- | --- |
| csgo-movement-reference.cpp | `2a54ab1eea115be7531b9154579c9381aaa57b1ea37449aed95fa3ad81153bd9` |
| csgo-base-reference.cpp | `d2ab5042bcb65dcfce1e6dfbe77fd3eb038f184e4594cf3a9c89a414b55323db` |
| csgo-cvars-reference.cpp | `efe3b04dcb027b2bfe8208596191f92d19bced011f23daf3e8f6d70fdf9b9efc` |

No native CS:GO replay comparison was performed. Existing CS2 CKZ replay fixtures remain CKZ regression evidence only.

## Implemented settings and behaviour

The versioned configuration is in `src/physics/profile.ts`; player and simulation receive it explicitly. CKZ calculations and behaviour remain selected through the CKZ profile.

VNL uses gravity 800, impulse 301.993377, ground acceleration 5.5, air acceleration 12, air projection limit 30, friction 5.2, stopspeed 80, max velocity 3500 per axis, step height 18, and standing/crouched hulls 32×32×72 / 32×32×54.

- No CKZ pre bonus, logarithmic perf, 275 ground cap, active-pre gate, crouchjump-bind suppression or CKZ duck-speed floor.
- Vanilla jump restriction crops full incoming speed to 1.1×250 before launch. Standing and crouching use distinct add/set launch paths, with source-style gravity ordering. Holding jump does not auto-bhop.
- Stamina jump cost .08, landing cost .05, maximum 80, recovery 60/s. Jump cost uses the actual jump velocity increment; landing uses pre-move fall velocity. The penalty affects jump strength and squared wish/max-speed scaling; it does not invent direct free-air braking. Speed-target scaling is sampled before recovery, jump strength after recovery, matching the inspected order.
- Duck edges cost 2 duck-speed units, recovery is 3/s, with an additional 6/s after moving sufficiently far from the last full-speed duck position. The 0.4-second re-duck gate and low-speed suppression replace CKZ's floor; unducking has a minimum rate of 1.5. Hull expansion remains clearance checked.
- Ground walking/ducking use appropriate speed cropping and ground acceleration scales. Deadstrafe remains a separate .25 surface-friction factor during unsupported slow rise, classified before final gravity in VNL.
- Ladder scale .78 and incidence-dependent lateral dampening .2 are selected for VNL. Walk/duck climbing is slower. Acquisition/top transitions still use our simplified ladder geometry model.
- CKZ ramp retry, shrunken-ground correction, downhill landing SlopeFix and the local >140 stair guard are disabled in VNL. Shared swept collision, step selection and bounded ground following remain. Removing a CKZ workaround does **not** prove the underlying solver is native.

## Commands, records and debugging

- `movement_profile`: show the full active configuration.
- `sv_airaccelerate`: show the current value. In VNL, `sv_airaccelerate 12` restores the default; values 0–1000 are accepted. Changing it reloads the map and gives records a different identity.
- `kz_state`: includes stamina and physics identity alongside hull/velocity diagnostics.
- `replay_last`: watch the last completed run from this session.
- `replay_export`: download that run, including its movement configuration.

Standard **64-tick / 64-step VNL at air acceleration 12 is ranked**, with its own Pro/TP leaderboards and stored replays. CKZ and VNL ranks, PBs and pending submissions are separate. True 128-tick, 64-command/128-step interpolation and custom air acceleration remain unranked with local PBs/replays. Practice finishes remain unranked in every mode. The server validates the declared mode and replay profile. Legacy CKZ submissions without a mode remain compatible.

The database migrates existing records to mode `ckz`, retaining replay IDs and compressed replay contents. A populated database is backed up before the transactional primary-key migration. The existing client-reported leaderboard is still not an anti-cheat service.

Vanilla timing controls live under **Settings > Vanilla options** in the left navigation. Changing timing reloads back into that settings section.

Replay v1 now also accepts 64 Hz VNL tracks. The VNL physics identity and `movement` envelope bind timing and air acceleration; other coefficients are fixed by the physics version. Old CKZ tracks remain supported. Playback still displays recorded states, not input resimulation; stamina is not serialized as complete resimulation state. Jump diagnostics use the selected acceleration and actual movement-step frequency.

## Verification and limits

`tests/vnl.test.ts` covers both native-style rates and the interpolated variant: analytical launch steps, crouched launch distinction, landing/repeated-jump fatigue and recovery, manual jump edges, no CKZ pre/perf leakage, ground crops, deadstrafe timing, duck-spam gating, frame-independent recorded tracks, replay validation and PB separation. Existing CKZ/native-air/replay tests still pass.

The full suite passed 130 tests before the final ground-duck/deadstrafe boundary check; the subsequent focused suite passed 48 tests including that new check. The final TypeScript/Vite production build passed, with the existing bundle-size advisory. Browser inspection confirmed the VNL menu and actual Dydanhomon map reach Ready. No expensive full-map replay sweep was used.

Remaining limitations: triangle collision instead of native convex/brush trace semantics, partial ground probes, approximate stair/ladder/duck contact transitions, JavaScript double precision rather than a complete float32 audit, digital rather than analog native commands, no water/base-velocity/moving-platform simulation, no weapon-specific speeds or combat modifiers, and no controlled native CS:GO comparison. Native VNL fidelity should be improved through targeted comparisons rather than adjusting coefficients to compensate for geometry errors.

Earlier documentation that frames modern CS2/subtick parity as the future vanilla goal is superseded by this fixed-tick CS:GO target.
