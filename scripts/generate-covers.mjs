import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const magazinesDirectory = path.join(root, "revistas");
const coversDirectory = path.join(root, "data", "capas");

async function generate() {
  await fs.mkdir(magazinesDirectory, { recursive: true });
  await fs.rm(coversDirectory, {
    recursive: true,
    force: true
  });
  await fs.mkdir(coversDirectory, { recursive: true });

  const entries = await fs.readdir(
    magazinesDirectory,
    { withFileTypes: true }
  );

  const pdfFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^\d{3}\.pdf$/i.test(name))
    .sort();

  for (const filename of pdfFiles) {
    const code = filename.replace(/\.pdf$/i, "");
    const pdfPath = path.join(
      magazinesDirectory,
      filename
    );
    const outputPrefix = path.join(
      coversDirectory,
      code
    );

    await execFileAsync(
      "pdftoppm",
      [
        "-f", "1",
        "-l", "1",
        "-singlefile",
        "-jpeg",
        "-jpegopt", "quality=84",
        "-scale-to-x", "700",
        "-scale-to-y", "-1",
        pdfPath,
        outputPrefix
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    console.log(`Capa criada: ${code}.jpg`);
  }

  console.log(`${pdfFiles.length} capa(s) gerada(s).`);
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
