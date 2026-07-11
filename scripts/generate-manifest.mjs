import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pdfDirectory = path.join(root, "revistas");
const pagesRoot = path.join(root, "data", "edicoes");
const dataDirectory = path.join(root, "data");
const outputFile = path.join(dataDirectory, "revistas.json");
const latestJsonFile = path.join(dataDirectory, "latest.json");
const latestScriptFile = path.join(dataDirectory, "latest.js");

const defaultSiteUrl =
  "https://revista.cianortecardmasters.com.br";

function webPath(...parts) {
  return parts.join("/").replaceAll(path.sep, "/");
}

function editionNumber(code) {
  return Number.parseInt(code, 10);
}

function normalizeSiteUrl(value) {
  const candidate = String(value || defaultSiteUrl).trim();

  try {
    const url = new URL(candidate);
    return url.href.replace(/\/$/, "");
  } catch {
    return defaultSiteUrl;
  }
}

function absoluteUrl(siteUrl, assetPath) {
  return new URL(
    String(assetPath || "").replace(/^\/+/, ""),
    `${siteUrl}/`
  ).href;
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

async function writeJson(filePath, payload) {
  await fs.writeFile(
    filePath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8"
  );
}

function createLatestPayload({
  generatedAt,
  siteUrl,
  magazine
}) {
  if (!magazine) {
    return {
      version: 1,
      generatedAt,
      siteUrl,
      latest: null
    };
  }

  const edition = magazine.slug.replace(
    /^edicao-/,
    ""
  );

  const readerUrl = new URL(siteUrl);
  readerUrl.searchParams.set(
    "revista",
    magazine.slug
  );
  readerUrl.searchParams.set("pagina", "1");

  return {
    version: 1,
    generatedAt,
    siteUrl,
    latest: {
      edition,
      number: editionNumber(edition),
      slug: magazine.slug,
      title: magazine.title,
      pagesCount: magazine.pagesCount,
      cover: absoluteUrl(siteUrl, magazine.cover),
      url: readerUrl.href,
      pdf: absoluteUrl(siteUrl, magazine.pdf)
    }
  };
}

async function main() {
  await fs.mkdir(pdfDirectory, {
    recursive: true
  });
  await fs.mkdir(pagesRoot, {
    recursive: true
  });
  await fs.mkdir(dataDirectory, {
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
  const generatedAt = new Date().toISOString();
  const siteUrl = normalizeSiteUrl(
    current.site?.url
  );

  const payload = {
    site: {
      title:
        current.site?.title || "CC Masters Zine",
      subtitle:
        current.site?.subtitle ||
        "Revistas da comunidade para folhear online",
      url: siteUrl
    },
    generatedAt,
    revistas: magazines
  };

  const latestPayload = createLatestPayload({
    generatedAt,
    siteUrl,
    magazine: magazines[0]
  });

  await writeJson(outputFile, payload);
  await writeJson(latestJsonFile, latestPayload);

  const latestScript = [
    "(() => {",
    `  const payload = ${JSON.stringify(latestPayload)};`,
    "  globalThis.CCMastersZineLatest = payload;",
    "  globalThis.dispatchEvent?.(",
    "    new CustomEvent(\"ccmasters-zine:latest\", {",
    "      detail: payload",
    "    })",
    "  );",
    "})();",
    ""
  ].join("\n");

  await fs.writeFile(
    latestScriptFile,
    latestScript,
    "utf8"
  );

  console.log(
    `Catálogo gerado com ${magazines.length} edição(ões).`
  );

  if (latestPayload.latest) {
    console.log(
      `Última edição publicada: ${latestPayload.latest.edition}.`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
