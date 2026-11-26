# Texture import and Divert review — 11 October 2026

**12 October placement correction:** the converter's baked overlay normal offset is about 15.5 Source units after this viewer's scale conversion. The asset pipeline now subtracts that exact offset from overlay POSITION accessors, retains authored placement, and uses renderer polygon depth bias to prevent flickering. This applies to Divert as well as affected new maps. Do not manually move individual decals or apply a global scene translation. Raw-export and adapted-render hashes are distinct; see [placement audit](FIVE-MAP-IMPORT.md).

The same pipeline now supports five additional audited maps. See [five-map import](FIVE-MAP-IMPORT.md) for IDs, material counts, native mesh triggers, the shader-specific `g_tColor1` cutout mapping and current limits. The two-map delivery below describes the original asset review.

## Delivered

`scripts/prepare-map-assets.mjs` provides a repeatable optional texture pass for both audited Workshop IDs. Run `npm.cmd run map:assets` for dydanhomon or append `--workshop-id 3692108902` for Divert. Prepare map geometry first. The temporary asset search path combines the outer Workshop material resources with the installed CS2/core resources; earlier exports only resolved the inner map plus base game. The renderer previously replaced every loaded material with a plain fallback, which also prevented texture restoration.

The asset pass copies every referenced PNG next to a separate textured GLB and sets `manifest.renderAsset`. It retains the plain GLB and never writes collision/ladder/trigger data. Both maps' collision hashes were verified unchanged. Asset reports record map identity, texture hashes and shader limitations. Source 2 Viewer 20 reads the material resources but warns about version-72 shader metadata in this CS2 installation; its fallback export provides useful textures, not exact native shading. Source lightmaps, full blended/animated shader behavior and separate 3D skybox composition remain unsupported.

Dydanhomon's actual key sound event is `kz_slide_dydanhomon2.key_collect`, referencing `sounds/key_collect.vsnd`. Entity trigger 195 starts `[PR#]key_sound` after 0.01 seconds. The sound is decoded to a 24,740-byte WAV. A per-entry callback drives browser audio after a user gesture; duplicate overlapping hull contacts are deduplicated, persistent contact stays silent, and noclip does not collect/play the key. Playback is a local cue; native distance attenuation/reverb are not reproduced. Divert's unrelated sounds are not implemented by this change.

## Review of the other agent's Divert import

Useful work retained: isolated work/output paths; explicit approved map identity; native collision and ladder tags; transformed trigger planes; context filters and delayed actions; authored destination pitch/yaw; separate courses; and page-reload map switching to isolate runtime state. The existing fixtures cover these features. No basis was found to discard that work or change movement constants.

Concrete fixes made during this review:

- **Stale trigger contact state after noclip.** The Divert transport returned early during noclip without clearing its continuous-touch clocks/history. Returning to a delayed volume could use an old entry timestamp and teleport immediately. Noclip now clears contact clocks and bhop history while preserving map context state.
- **Checkpoint relocation only cleared part of trigger state.** It cleared the base touching set but left Divert's derived clocks/history. A polymorphic `clearContacts()` now clears the corresponding derived state too. A regression covers both entry points.
- **Unresolved/plain materials.** Added the missing Workshop material search path and material export flags, then retained exported materials in the viewer. Marker blending remains map-specific.
- **Overexposed imported lighting.** Divert's GLB contains a directional light with intensity 683. Combining uncalibrated Source lighting with the viewer lights washed ground/foliage white. Imported lights are now disabled in favor of the existing preview lighting; native lighting needs a dedicated conversion rather than re-enabling these values blindly.
- **Lost foliage alpha in the texture export.** VRF's VCS fallback wrote fully opaque alpha into cutout color PNGs. The native pine texture had alpha ranging 0–255, while the adapted export was 255 everywhere sampled. The asset pass now decodes native color textures for MASK materials and retains the GLB's authored alpha-test thresholds. This restores six Divert cutout materials. These exporter issues were discovered in this follow-up, not concealed as completed native shader support.

The trigger-plane rotation/scale conversion and the rule that the last single-bhop block may be any bhop type agree with the inspected pinned source and existing geometry checks. These checks are narrower than a full-course native comparison.

## Reminders for the next agent

**Additional-map decal fix:** the MASK-only alpha restoration below was insufficient for translucent overlays. Native `csgo_static_overlay.vfx` uses `F_BLEND_MODE` (1 blend, 2 cutout), which VRF's glTF exporter omits. `scripts/material-adaptation.mjs` now translates those modes and preserves unlit shading. Native color alpha is restored for MASK and translucent overlay materials; `extras.nativeOverlay` also preserves native no-depth-write behavior. See [five-map follow-up](FIVE-MAP-IMPORT.md). Do not hide these authored markings or make their render planes collidable.

1. Divert's **100 anti-bhop, 74 checkpoint/pause modifier and 10 stage triggers** were intentionally exported only as diagnostics by the prior implementation. Those native restrictions/stage splits remain unimplemented. Do not describe this as full native map-rule support. Implementing them requires a separate scoped change and dedicated validation, not a visual fix.
2. General entity I/O, Divert sounds/fades, Source 2 lighting, blended/animated materials and the separate 3D skybox are still incomplete. The existing Divert import audit's older statement that ordinary textures are omitted is superseded by this follow-up; its gameplay limitations still apply.
3. Re-running geometry preparation recreates the manifest. Follow it with the asset pass; do not hand-edit generated PNGs or the GLB as the permanent solution. A changed Workshop package must be fully reimported before exporting textures from it.
4. Tests use both prepared maps. Keep the original map fixtures when changing Divert. Asset checks allow plain-only preparation, but validate all texture dependencies when the optional textured variant is enabled.
5. A texture export can succeed despite shader warnings. Keep the logs under each map's `.map-work/.../assets/`, inspect the rendered output and report unsupported effects. Do not silently upgrade the pinned converter just to suppress warnings.

## Verification

63 tests passed, including the existing map/movement checks, trigger contact reset, pickup entry deduplication and texture dependency/WAV validation. Collision hashes still match both original prepared manifests. Browser screenshots show the restored surface textures. Expert full-course gameplay testing and a subjective comparison of the key audio mix have not been performed by the agent.
