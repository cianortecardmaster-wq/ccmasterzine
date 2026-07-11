import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pdfDirectory = path.join(root, "revistas");
const pagesRoot = path.join(root, "data", "edicoes");
const outputFile = path.join(root, "data", "revistas.json");

function webPath(...parts) {
  return parts.join("/").replaceAll(path.sep, "/");
}

function editionNumber(code) {
  return Number.parseInt(code, 10);
}

async function readJson(filePath) {
  try {
    return JSON.parse(
      await fs.readFile(filePath, "utf8")
    );
  } catch {
    return {};
  }
}

async function main() {
  await fs.mkdir(pdfDirectory, {
    recursive: true
  });
  await fs.mkdir(pagesRoot, {
    recursive: true
  });
  await fs.mkdir(path.dirname(outputFile), {
    recursive: true
  });

  const entries = await fs.readdir(
    pdfDirectory,
    { withFileTypes: true }
  );

  const codes = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^\d{3}\.pdf$/i.test(name))
    .map((name) => name.replace(/\.pdf$/i, ""))
    .sort((a, b) => editionNumber(b) - editionNumber(a));

  const magazines = [];

  for (const code of codes) {
    const editionDirectory = path.join(
      pagesRoot,
      code
    );

    let pageFiles = [];

    try {
      pageFiles = (await fs.readdir(editionDirectory))
        .filter((name) => /^\d{3}\.jpg$/i.test(name))
        .sort((a, b) =>
          a.localeCompare(b, "pt-BR", {
            numeric: true
          })
        );
    } catch {
      pageFiles = [];
    }

    if (pageFiles.length === 0) {
      console.warn(
        `Edição ${code} ignorada: páginas não encontradas.`
      );
      continue;
    }

    magazines.push({
      slug: `edicao-${code}`,
      title: `Edição ${code}`,
      type: "images",
      pdf: webPath("revistas", `${code}.pdf`),
      cover: webPath(
        "data",
        "edicoes",
        code,
        pageFiles[0]
      ),
      pagesCount: pageFiles.length,
      pages: pageFiles.map((filename) =>
        webPath(
          "data",
          "edicoes",
          code,
          filename
        )
      )
    });
  }

  const current = await readJson(outputFile);

  const payload = {
    site: {
      title:
        current.site?.title || "CC Masters Zine",
      subtitle:
        current.site?.subtitle ||
        "Revistas da comunidade para folhear online"
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
    `Catálogo gerado com ${magazines.length} edição(ões).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
