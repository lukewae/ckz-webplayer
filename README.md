# CKZ web demo

Four-map browser KZ demo, with editable TypeScript/Three.js source and the tested static build.

Live game: https://ckz-three-map-demo.vercel.app

| Map | Classic tier |
| --- | --- |
| kz_phamous | 1 |
| kz_kiwiexultation | 7 |
| kz_slide_dydanhomon2 | 5 |
| kz_faded | 3 |

The deployed build totals 94.06 MB. Gameplay, local personal bests and the existing last-run replay are supported. Steam login, shared leaderboards and online replay hosting are disabled. No backend is needed for this version.

## Run and edit

Requires Node 24.15+ and npm. From the repository root:

```sh
npm ci
npm run dev
npm test
```

## Build and deploy

The committed `demo/` folder is the exact tested four-map deployment. Vercel configuration serves that folder without an install or build step. To deploy the committed demo, run `npx vercel@latest` from this repository, selecting the intended account/project. Linking this repository to an existing Vercel project is a separate step.

After changing source, run `npm run build` to regenerate `demo/`, test with `npm run preview`, and commit the regenerated build before redeploying. A rebuilt version uses root `/maps/` paths rather than the original versioned snapshot's paths; all required assets are copied from `public/` automatically.

Source code is in `src/` and `shared/`. `public/` holds only the four maps' active runtime dependencies, thumbnails and audio. Git deduplicates identical asset content shared with `demo/`. No LFS download is required: the actual runtime files are included, and each file is below GitHub's 100 MB file limit.

Map data, collision, materials and scripts retain the current browser prototype's limitations; this is not complete native CS:GO/CS2 parity. The documents in `docs/` are historical reference audits from the main project and may describe additional maps or server-only functionality absent here.

## Attribution

Application source is AGPL-3.0-only; see LICENSE and THIRD_PARTY.md. Existing upstream notices are preserved in licenses/. Workshop/game assets remain the property of their authors/Valve and are separate from the application source licence. This private repository does not change those rights.
