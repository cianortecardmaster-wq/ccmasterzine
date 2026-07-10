import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const magazinesDirectory = path.join(root, "revistas");
const outputFile = path.join(root, "data", "revistas.json");

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"]);
const ignoredNames = new Set([".gitkeep", "README.md", "readme.md"]);

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromFilename(value) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function naturalSort(a, b) {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

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

async function scan() {
  await fs.mkdir(magazinesDirectory, { recursive: true });
  await fs.mkdir(path.dirname(outputFile), { recursive: true });

  const entries = await fs.readdir(magazinesDirectory, { withFileTypes: true });
  const magazines = [];

  for (const entry of entries.sort((a, b) => naturalSort(a.name, b.name))) {
    if (ignoredNames.has(entry.name) || entry.name.startsWith(".")) continue;

    const fullPath = path.join(magazinesDirectory, entry.name);

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf") {
      magazines.push({
        slug: slugify(entry.name),
        title: titleFromFilename(entry.name),
        type: "pdf",
        file: webPath("revistas", entry.name)
      });
      continue;
    }

    if (!entry.isDirectory()) continue;

    const metadata = await readJson(path.join(fullPath, "meta.json"));
    const children = await fs.readdir(fullPath, { withFileTypes: true });
    const files = children.filter((child) => child.isFile()).map((child) => child.name);
    const pdfFiles = files
      .filter((name) => path.extname(name).toLowerCase() === ".pdf")
      .sort(naturalSort);
    const imageFiles = files
      .filter((name) => imageExtensions.has(path.extname(name).toLowerCase()))
      .sort(naturalSort);

    const slug = metadata.slug || slugify(entry.name);
    const title = metadata.title || titleFromFilename(entry.name);

    if (pdfFiles.length > 0) {
      const selectedPdf = metadata.file && pdfFiles.includes(metadata.file)
        ? metadata.file
        : pdfFiles[0];

      magazines.push({
        slug,
        title,
        description: metadata.description || "",
        date: metadata.date || "",
        type: "pdf",
        file: webPath("revistas", entry.name, selectedPdf)
      });
      continue;
    }

    if (imageFiles.length > 0) {
      const coverName = metadata.cover && imageFiles.includes(metadata.cover)
        ? metadata.cover
        : imageFiles[0];

      magazines.push({
        slug,
        title,
        description: metadata.description || "",
        date: metadata.date || "",
        type: "images",
        cover: webPath("revistas", entry.name, coverName),
        pages: imageFiles.map((name) => webPath("revistas", entry.name, name))
      });
    }
  }

  magazines.sort((a, b) => {
    if ((a.date || "") !== (b.date || "")) return (b.date || "").localeCompare(a.date || "");
    return naturalSort(a.title, b.title);
  });

  const current = await readJson(outputFile);
  const payload = {
    site: {
      title: current.site?.title || "Acervo de Revistas",
      subtitle: current.site?.subtitle || "Publicações para folhear online"
    },
    generatedAt: new Date().toISOString(),
    revistas: magazines
  };

  await fs.writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Catálogo gerado com ${magazines.length} revista(s).`);
}

scan().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
