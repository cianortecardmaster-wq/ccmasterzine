import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const magazinesDirectory = path.join(root, "revistas");
const coversDirectory = path.join(root, "data", "capas");
const outputFile = path.join(root, "data", "revistas.json");

function webPath(...parts) {
  return parts.join("/").replaceAll(path.sep, "/");
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function editionNumber(filename) {
  return Number.parseInt(filename.replace(/\.pdf$/i, ""), 10);
}

function editionCode(filename) {
  return filename.replace(/\.pdf$/i, "");
}

async function scan() {
  await fs.mkdir(magazinesDirectory, { recursive: true });
  await fs.mkdir(coversDirectory, { recursive: true });
  await fs.mkdir(path.dirname(outputFile), { recursive: true });

  const entries = await fs.readdir(
    magazinesDirectory,
    { withFileTypes: true }
  );

  const pdfFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^\d{3}\.pdf$/i.test(name))
    .sort((a, b) => editionNumber(b) - editionNumber(a));

  const magazines = [];

  for (const filename of pdfFiles) {
    const code = editionCode(filename);
    const coverFilename = `${code}.jpg`;
    const coverPath = path.join(coversDirectory, coverFilename);

    magazines.push({
      slug: `edicao-${code}`,
      edition: editionNumber(filename),
      title: `Edição ${code}`,
      type: "pdf",
      file: webPath("revistas", filename),
      cover: (await pathExists(coverPath))
        ? webPath("data", "capas", coverFilename)
        : ""
    });
  }

  const current = await readJson(outputFile);
  const payload = {
    site: {
      title: current.site?.title || "Acervo de Revistas",
      subtitle:
        current.site?.subtitle ||
        "Publicações para folhear online"
    },
    generatedAt: new Date().toISOString(),
    revistas: magazines
  };

  await fs.writeFile(
    outputFile,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8"
  );

  console.log(
    `Catálogo gerado com ${magazines.length} revista(s).`
  );
}

scan().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
