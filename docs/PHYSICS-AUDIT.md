# Physics fix audit — 12 October 2026

## Result

The new takeoff correction and landing-pre rule do not replace the older collision, duck-hull, ladder or input-scheduling fixes. They operate on different paths. No earlier fix was removed and no runtime physics changed in this audit. Source fidelity remains partial: some code follows the CKZ plugin, some matches selected native samples, and some is an explicitly requested local compatibility rule.

References checked: the cached upstream checkout, current [CKZ cvars](https://github.com/KZGlobalTeam/cs2kz-metamod/blob/master/src/kz/mode/kz_mode_ckz.h), [CKZ hooks](https://github.com/KZGlobalTeam/cs2kz-metamod/blob/master/src/kz/mode/kz_mode_ckz.cpp), [VNL cvars](https://github.com/KZGlobalTeam/cs2kz-metamod/blob/master/src/kz/mode/kz_mode_vnl.h), and [VNL movement predictor](https://github.com/KZGlobalTeam/cs2kz-metamod/blob/master/src/kz/mode/kz_mode_vnl.cpp). The public plugin is not the entire closed CS2 engine.

## Cross-check of earlier changes

| Change | Does the new work supersede it? | Assessment |
| --- | --- | --- |
| Raw mouse input and browser key handling | No | Input delivery fixes; independent of movement coefficients. |
| Shared command angles, midpoint first half-step | No | CKZ-specific scheduling. Selected native air samples support retaining it. Do not automatically apply it to vanilla subtick view input. |
| Air acceleration 100, wish projection limit 30 | No | Matches CKZ cvars. Native free-air fixtures support the current uncapped-wishspeed acceleration budget. No compensating acceleration nerf was introduced. |
| Zero jump/landing stamina costs | No | CKZ configuration. Slow-rise surface friction is a separate mechanism and should not be removed merely because stamina is disabled. |
| Standing/crouched hulls and airborne +9 feet offset | No | The hull offset changes clearance, not launch velocity. New jump integration changes the standing apex from 57 to 55.828125, and jump-then-duck clearance from about 66 to 64.83. Do not subtract another 1.17 from duck clearance. |
| Duck transitions, CKZ bind suppression and speed floor | No | CKZ hook rules are distinct from our still-approximate engine transition model. Native standing takeoff evidence does not validate every fully crouched/pre-duck jump variant. |
| Fast-ladder projection | No | Separate ladder branch. CKZ ladder multipliers fit this mode; acquisition, top transitions and cooldown remain approximate. |
| Ground-following snap | No | Runs after grounded walking. A jump has already cleared the ground flag and bypasses it. It prevents false downhill airborne/landing resets; changing takeoff gravity cannot fix that. |
| Ramp trace retries / shrunken ground checks | No | Handle geometry/contact normals, not takeoff. Still constrained by our triangle trace backend. |
| Downhill landing SlopeFix | No | Adjusts landing velocity once on new contact. Independent of jump integration and ground-following, though native landing-state fidelity is incomplete. |
| Uphill stair boost guard | No, but provisional | Runs on ground collision, not a commanded jump. The >140 cutoff is a local guard using the existing detach threshold, not a demonstrated native StepMove implementation. |
| Landing-pre active-use gate | Does not replace pre decay or perf logic | It gates the ground acceleration target; stored ratios remain for perf. It also affects stopping a turn on ordinary ground, not only landing. This is a local behavioural departure from upstream. |
| 275 ground cap | Still independently needed for the requested profile | Limits active ground pre; the new gate only stops inactive pre from being reused. Upstream nominal base + pre is 276. |

## Findings that must not become universal engine rules

1. **Three local policies need explicit ownership:** the 275 cap (including its initial landing-window exemption), active-use pre gate, and uphill stair guard. None is established as an exact native cvar/hook combination. Retained here because the user requested those behaviours; do not silently call them stock CKZ or stock CS2.
2. **The new takeoff adjustment has a limited evidence scope:** clean standing CKZ legacy-jump samples at the current 1/128 step. It is not proof of modern vanilla jump ordering. Do not combine it with a future native jump integrator that already includes that gravity contribution.
3. **Collision is still a major fidelity gap.** Our `clip` is a simple inward-velocity projection. The plugin's VNL predictor explicitly includes a 0.03125 normal-separation contribution in its CS2 velocity clip, along with other solver details absent here. Our SAT trace epsilon and CKZ trace offsets are not proof of equivalence. Adding just that velocity term could double-count parts of our contact workaround; port and validate the solver coherently instead.
4. **Other cvars are not fully modelled.** For example, upstream exposes `sv_step_move_vel_min`; our stair routine does not implement its native semantics. Weapon-dependent movement, water, modern jump precision and general stamina are also incomplete/absent. Cvar values alone cannot certify the engine.
5. **Wide-corner gain remains open.** Sixteen native regression samples and the broader filtered comparison cover ordinary free-air turning, not a matched large-flick corner jump. The takeoff correction is too small to establish that the whole reported advantage is solved.

## Boundary for a future vanilla mode

Keep a shared collision/math core, with a movement profile and explicit per-mode hooks for jump processing, input scheduling, pre/perf, duck policy, stamina, ladder scaling and ramp fixes. Keep local compatibility policies separate from both the profile's source cvars and the common engine. This is a design requirement for that work, not a refactor implemented by this review.

Useful comparison from the inspected plugin headers:

| Setting | CKZ | CS2KZ VNL reference |
| --- | --- | --- |
| Ground / air acceleration | 6.5 / 100 | 5.5 / 12 |
| Air wish limit / gravity / friction | 30 / 800 / 5.2 | Same |
| Legacy jump / jump precision | On / off | Off / on |
| Subtick movement view angles | Off, with CKZ interpolation | On |
| Ladder dampening / scale | 1 / 1 | 0.2 / 0.78 |
| Stamina jump cost / land cost / maximum / recovery | 0 / 0 / 0 / 9999 | 0.08 / 0.05 / 80 / 60 |
| Minimum interval between ducks | 0 | 0.4 |
| Pre / logarithmic perf hooks | CKZ hooks | Do not inherit |

CS2KZ's VNL profile is a reference, not a guarantee of untouched matchmaking defaults: its own header deliberately overrides maxspeed for the no-weapon case, and it has plugin trigger handling. Choose and pin the target CS2 build/configuration when implementing vanilla. A selector that only changes air acceleration would mislabel the current CKZ behaviour.

Preserve prior replay state tracks and stamp any future behaviour change with a new physics profile. A cvar/compatibility snapshot will also be needed before input-only replay validation can compare different modes reliably.
