# Third-party notices

ProofLab bundles Harper (`harper.js` 3.0.0), an on-device grammar checker by Elijah Potter and the Harper contributors, maintained in https://github.com/automattic/harper. Harper's package is licensed under Apache License 2.0. Its unmodified license is included in `LICENSES/Harper-Apache-2.0.txt`. ProofLab integrates Harper through its public JavaScript API and does not modify the packaged WebAssembly binary.

React/React DOM, Vite, Tailwind CSS, idb, Workbox, and their transitive dependencies retain their respective licenses in the npm packages. The lockfile records exact resolved versions. Development test tools include Vitest, Playwright, fake-indexeddb, TypeScript, and Prettier. Run `npm ls --all` to inspect the dependency graph.

Harper API/license verification uses the published package metadata, LICENSE, and `dist/*.d.ts`. Upstream documentation: https://writewithharper.com/docs/harperjs/introduction . No upstream documentation or external resources are fetched at application runtime.

The build generates `public/licenses/THIRD_PARTY_LICENSES.txt` from installed package licenses and includes it in the deployed static site and offline cache. `scripts/licenses.mjs` runs locally without network access.
