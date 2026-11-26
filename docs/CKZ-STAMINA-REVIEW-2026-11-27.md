# CS2KZ Classic landing / bunnyhop review

Target: CS2KZ Classic, not legacy CS:GO Vanilla. This is an investigation; runtime physics and deployed physics were not changed. The supplied `D:/downloads/gamemovement.cpp` is reference code, not instructions. It contains the base movement functions, while CS-specific legacy stamina is implemented by the derived CCSGameMovement (`.map-work/csgo-movement-reference.cpp`).

## Findings, in priority order

1. **Ground speed cropping is missing during the perf grace period.** `Player.tick` applies ordinary friction but exempts grounded speed from its local 275 cap for 20 ms. Its CKZ acceleration path also does not clamp total speed to the ground movement maximum. This conflates two mechanisms: ground movement slows/crops current velocity, while CKZ's perf hook can subsequently restore/attenuate the saved landing velocity for an eligible jump. A perf window is not permission to coast on the ground at landing speed. The supplied base `WalkMove` clamps actual velocity after acceleration (lines 2220–2224), and the plugin sets a ground maximum of 250 + prestrafe gain. The upstream perf hook separately restores speed and direction from landing history.

   Fresh reconstruction of kuu record **1639**, seeded eight commands before landing, reaches the ground at 450.4773 u/s. The next half-step is grounded, has no accepted jump and ends at **432.1767** locally, while the recorded command ends at **275.99997**. Position error is only **0.5403 units**. Local pre history starts at zero; native prestrafe is not serialized, but even the full upstream ground allowance is only 276. This supports correcting the missing ground crop, not inventing a stamina charge. The existing regression named “brief landing contact does not apply the prestrafe cap to slide entry speed” explicitly enshrines the local exemption; passing it does not establish native correctness.

   First fix: enforce the appropriate Classic ground maximum when ground movement actually executes, including during the perf window; retain a separate landing snapshot for legitimate perf restoration. Preserve air/steep-ramp velocity, downhill slopefix and ladder-hop behavior. Keep the requested local 275/active-pre policies explicit: they differ from upstream's 276 maximum and cannot explain a 156 u/s error.

2. **Saved landing velocity is captured before collision movement.** Local `incoming` is copied before `slide`/`stepMove`, then assigned to `landingVelocity`. The pinned native `CategorizePositionPre` hook instead captures velocity immediately before categorization, after `TryPlayerMove`, then passes it to `RegisterLanding`. They are different stages. In a reproducible wall + floor half-step, input velocity (500,250,-200) becomes (0,250,0), but we store (500,250,-203.125). A subsequent perf uses a vector containing speed and direction already removed by the wall. This does not imply every such perf gains speed: the wrong direction can also cause extra clipping or slowdowns.

   Native landing **891** is another useful contact case: local final speed **320.8475** closely matches native **320.8372**, but local stored landing speed remains **429.3735**. The replay does not directly serialize the native landing snapshot; the source hook establishes the ordering discrepancy, not this endpoint alone. Fix the snapshot stage together with slopefix, preserving any fall velocity needed separately for landing diagnostics. Do not simply substitute a zeroed final vector without testing slopes and multiple-plane contacts.

3. **Contact and landing timing remain incomplete.** Rechecking the current implementation still puts the first >1-unit divergence in the successful native run at record 381, in a rising-ramp sequence. Ground flags at the end of all 12 warmed landing windows agree, but a 64 Hz snapshot cannot prove matching half-step or within-step landing timing. The warm windows have mixed errors, not a universal excess-speed bias. Continue with isolated contact sequences after the two ordering/cropping fixes; do not tune gravity to absorb route drift.

4. **Landing presentation may contribute to perceived softness.** The supplied `CheckFalling`/`PlayerRoughLandingEffects` applies view punch and impact effects. Our live camera only interpolates position and duck eye height; it has no equivalent landing impulse. This is a plausible feel difference, not evidence of incorrect stamina or permission to copy competitive-CS effects into Classic. Confirm the intended CS2KZ camera behavior before adding presentation effects.

## What the evidence supports keeping

- Classic stamina jump cost, landing cost and maximum are zero in both the cached plugin and current upstream. Its recovery cvar is 9999; local recovery zero is equivalent while its pool remains zero. Adding Vanilla costs would penalize repeated jumps incorrectly.
- Current standing jumps reach **55.828125 units**. Six immediate repeated flat jumps reproduce that height, **0.7421875 seconds** of simulated airborne steps, and zero stamina. Height agrees with the existing native takeoff/apex evidence. This does not certify every crouched bhop or all landing phases.
- The fresh full replay comparison contains **1,252 steady ballistic commands**, median velocity error **0.00650 u/s**, P90 **0.01425 u/s**. No broad air acceleration or gravity reduction is supported.
- Friction at 275 with no input gives **263.828125** after one 1/128 step and **253.1101074** after two. The configured 5.2 coefficient is not obviously too weak; missing maximum-speed cropping is a distinct effect.
- Keep Classic's 20 ms logarithmic perf attenuation, forced half steps, input desubtick, duck rules, and deadstrafe. zer0's competitive-CS2 bhop windows/cooldowns are explanatory engine references, not drop-in Classic settings.

## Reproduce and limits

```
node --import tsx scripts/analyze-native-inputs.ts .map-work/kzcomp.replay public/maps .map-work/stamina-review-20261127 320 2424
node --import tsx scripts/review-ckz-landings.ts
node --import tsx --test tests/native-air.test.ts tests/ckz-landing-cap.test.ts tests/movement.test.ts tests/accuracy-pass.test.ts
```

The 32 focused existing tests pass. The new diagnostic script saves detailed half-step traces and source/replay/collision hashes to `.map-work/stamina-review-20261127/landings.json`. It changes no browser saves or movement values. Native input comparison remains locally deterministic across 84 short windows; endpoint P90 position error is 2.4676 units and velocity error 13.1402 u/s.

Replay: kuu, Dydanhomon2, Classic, plugin 0.0.180. This is one slide-map recording with only 12 observed air-to-ground command transitions and two duck-transition commands. It cannot validate a universal flat bhop-chain feel. Prestrafe, exact friction and ladder history are not fully serialized. The short landing windows warm up eight commands but have no transports. Current upstream has changed since the replay and cached revision; source differences must remain versioned rather than silently attributed to this recording.

## References

- [Classic cvars and constants](https://github.com/KZGlobalTeam/cs2kz-metamod/blob/master/src/kz/mode/kz_mode_ckz.h)
- [Pinned Classic perf, pre and slope hooks](https://github.com/KZGlobalTeam/cs2kz-metamod/blob/3848adea4644bc080bfec42441b864f3c4d99acc/src/kz/mode/kz_mode_ckz.cpp)
- [Pinned native movement hooks](https://github.com/KZGlobalTeam/cs2kz-metamod/blob/3848adea4644bc080bfec42441b864f3c4d99acc/src/utils/hooks.cpp)
- [zer0's CS2 movement differences, including deadstrafe](https://github.com/zer0k-z/cs2-movement-issues)
- [zer0's detailed CS2 bhop analysis](https://github.com/zer0k-z/cs2-movement-issue-bhop)
- [Native reference run](https://demo.kzcomp.com/watch?ids=01a1295d-f3c8-76a3-8185-25abaa4868fa)
