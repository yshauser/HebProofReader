import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FIXTURE_NAMES, fixtureBuilders } from "../tests/helpers/docxFixtures.ts";

const outDir = fileURLToPath(new URL("../tests/fixtures/docx/", import.meta.url));
await mkdir(outDir, { recursive: true });
for (const name of FIXTURE_NAMES) {
  await writeFile(`${outDir}${name}.docx`, await fixtureBuilders[name]());
  console.log(`wrote tests/fixtures/docx/${name}.docx`);
}
