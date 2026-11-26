# Classic landing speed and perf restoration

Implemented the two bounded corrections from [the stamina investigation](CKZ-STAMINA-REVIEW-2026-11-27.md).

- Ground movement now applies the existing local 275 u/s speed ceiling on every grounded movement step, including the 20 ms perf window. Jump handling still runs first. The saved landing velocity survives ordinary friction/cropping, so eligible delayed perfs restore and attenuate it with the existing CKZ formula.
- Landing velocity is saved after collision movement and before ground categorization. Slopefix projects that same post-movement vector; collision-removed velocity cannot reappear in the perf snapshot. The pre-movement vector remains available separately for corrected landing-distance diagnostics. VNL's existing landing/stamina path is unchanged.
- The previously requested 275 ceiling and active-pre acceleration policy remain local compatibility rules. This change does not substitute upstream's full 276 maximum or add vanilla stamina, change gravity, air acceleration, duck rules or jump impulse.

Physics identity: `ckz-browser-2026-11-27-ground-crop`. Prior frame-based replays remain accepted and playable. Local PBs are keyed by physics identity, so this revision starts a separate PB baseline; previous browser records remain stored under their prior identity.

## Measured before and after

Same kuu Classic replay (plugin 0.0.180), map collision, native commands and 84 short windows. Windows are seeded once and preserve local state thereafter.

| Metric | Before | After |
| --- | ---: | ---: |
| Window endpoint P90 position error (units) | 2.4676 | 2.4335 |
| Window endpoint P90 velocity error (u/s) | 13.1402 | 10.4182 |
| Window endpoint P90 horizontal velocity error (u/s) | 10.4182 | 10.3656 |
| Steady free-air P90 velocity error (u/s), 1,252 commands | 0.01425 | 0.01425 |
| Warmed native landing 1639 speed, native ≈276 | 432.1767 | 275 |
| Landing 891 saved horizontal speed, after collision | 429.3735 | 320.8475 |

At 891, actual movement speed remains 320.8475 (native 320.8372); only the saved snapshot changes. Synthetic simultaneous wall/floor contact now saves (0,250,0), matching collision-resolved velocity, instead of (500,250,-203.125). Immediate and delayed perfs at 0, 7.8125 and 15.625 ms retain legitimate saved flat-landing speed.

The warmed 1639 position error changes from 0.5403 to approximately 0.688 units: speed is substantially more accurate, but contact/displacement timing remains imperfect. This is not full native parity. Earliest one-unit route divergence remains the rising-ramp sequence at 381. The replay does not serialize every native pre/friction/landing state. A speculative ground ceiling based on zero-initialized prestrafe worsened the aggregate comparison and was discarded; the bounded correction keeps the established local cap.

## Verification

New regressions cover ground displacement during the perf window, preserved saved speed after one/two grounded steps, wall/floor collision restoration, high-speed air movement and native landing 1639. Existing slope/stair collision, duck, ladder, timing, VNL, replay and ranking checks pass.

- Full project: **207/209 tests pass**. The two existing failures are missing optional texture dependencies in the full Dydanhomon and Divert exports, unrelated to movement. Local HTTP integration tests pass outside the filesystem sandbox.
- Standalone demo: **62/62 tests pass**, TypeScript and production build pass.
- Full-project TypeScript and production build pass.

Full-source reproduction:

```
node --import tsx scripts/analyze-native-inputs.ts .map-work/kzcomp.replay public/maps .map-work/ground-crop-after 320 2424
node --import tsx scripts/review-ckz-landings.ts .map-work/ground-crop-after
npm test
npm run build
```

Detailed local before/after reports include replay, collision and physics source hashes. No existing saved PB or replay was rewritten.
