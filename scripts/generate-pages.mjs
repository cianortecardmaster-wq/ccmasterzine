import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const pdfDirectory = path.join(root, "revistas");
const outputRoot = path.join(root, "data", "edicoes");

function numericCompare(a, b) {
  return a.localeCompare(b, "pt-BR", {
    numeric: true,
    sensitivity: "base"
  });
}

async function generateEdition(filename) {
  const code = filename.replace(/\.pdf$/i, "");
  const pdfPath = path.join(pdfDirectory, filename);
  const editionDirectory = path.join(outputRoot, code);
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), `zine-${code}-`)
  );
  const prefix = path.join(temporaryDirectory, "pagina");

  await fs.rm(editionDirectory, {
    recursive: true,
    force: true
  });
  await fs.mkdir(editionDirectory, {
    recursive: true
  });

  try {
    await execFileAsync(
      "pdftoppm",
      [
        "-jpeg",
        "-jpegopt", "quality=88,optimize=y,progressive=y",
        "-scale-to-x", "1200",
        "-scale-to-y", "-1",
        pdfPath,
        prefix
      ],
      {
        maxBuffer: 20 * 1024 * 1024
      }
    );

    const generated = (await fs.readdir(temporaryDirectory))
      .filter((name) => /^pagina-\d+\.jpg$/i.test(name))
      .sort(numericCompare);

    if (generated.length === 0) {
      throw new Error(
        `Nenhuma página foi gerada para ${filename}.`
      );
    }

    for (let index = 0; index < generated.length; index += 1) {
      const destinationName =
        `${String(index + 1).padStart(3, "0")}.jpg`;

      await fs.copyFile(
        path.join(temporaryDirectory, generated[index]),
        path.join(editionDirectory, destinationName)
      );
    }

    console.log(
      `${filename}: ${generated.length} página(s) convertida(s).`
    );
  } finally {
    await fs.rm(temporaryDirectory, {
      recursive: true,
      force: true
    });
  }
}

async function main() {
  await fs.mkdir(pdfDirectory, {
    recursive: true
  });

  await fs.rm(outputRoot, {
    recursive: true,
    force: true
  });
  await fs.mkdir(outputRoot, {
    recursive: true
  });

  const entries = await fs.readdir(
    pdfDirectory,
    { withFileTypes: true }
  );

  const pdfs = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^\d{3}\.pdf$/i.test(name))
    .sort(numericCompare);

  for (const filename of pdfs) {
    await generateEdition(filename);
  }

  console.log(
    `${pdfs.length} edição(ões) processada(s).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
