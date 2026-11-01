import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
const packages = [
  "harper.js",
  "react",
  "react-dom",
  "scheduler",
  "idb",
  "fflate",
  "workbox-core",
  "workbox-routing",
  "workbox-strategies",
  "workbox-precaching",
  "tailwindcss",
  "vite",
];
const sections = [
  "ProofLab — bundled third-party licenses\n\nHarper is used without modification through its public JavaScript API.\nNo resources are loaded from third-party services at runtime.",
];
for (const name of packages) {
  const root = `node_modules/${name}`;
  const metadata = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
  const filename = ["LICENSE", "LICENSE.md", "LICENSE.txt"].find((name) =>
    existsSync(`${root}/${name}`),
  );
  if (!filename) throw new Error(`Missing license for ${name}`);
  sections.push(
    `${"=".repeat(72)}\n${name} ${metadata.version}\n${metadata.license || ""}\n\n${readFileSync(`${root}/${filename}`, "utf8")}`,
  );
}
mkdirSync("public/licenses", { recursive: true });
writeFileSync(
  "public/licenses/THIRD_PARTY_LICENSES.txt",
  sections.join("\n\n"),
);
