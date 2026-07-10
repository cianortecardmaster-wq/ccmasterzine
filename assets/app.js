import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs";

const state = {
  catalog: [],
  activeMagazine: null,
  pdfDocument: null,
  currentPage: 1,
  totalPages: 1,
  zoom: 1,
  renderToken: 0,
  touchStartX: null
};

const elements = {
  libraryView: document.querySelector("#library-view"),
  readerView: document.querySelector("#reader-view"),
  grid: document.querySelector("#magazine-grid"),
  emptyState: document.querySelector("#empty-state"),
  summary: document.querySelector("#library-summary"),
  search: document.querySelector("#search-input"),
  template: document.querySelector("#magazine-card-template"),
  title: document.querySelector("#reader-magazine-title"),
  status: document.querySelector("#page-status"),
  slider: document.querySelector("#page-slider"),
  stage: document.querySelector("#reader-stage"),
  frame: document.querySelector("#page-frame"),
  canvas: document.querySelector("#pdf-canvas"),
  image: document.querySelector("#image-page"),
  loading: document.querySelector("#reader-loading"),
  previous: document.querySelector("#previous-page"),
  next: document.querySelector("#next-page"),
  back: document.querySelector("#reader-back"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomReset: document.querySelector("#zoom-reset"),
  fullscreen: document.querySelector("#fullscreen-button"),
  theme: document.querySelector("#theme-toggle")
};

function naturalCompare(a, b) {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

/**
 * Converts every path segment to a valid URL.
 * This also handles filenames containing #, spaces, accents and parentheses.
 */
function assetUrl(assetPath) {
  const normalized = String(assetPath || "").replaceAll("\\", "/");
  const encoded = normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return new URL(encoded, document.baseURI).href;
}

async function loadCatalog() {
  try {
    const catalogUrl = new URL(`data/revistas.json?v=${Date.now()}`, document.baseURI);
    const response = await fetch(catalogUrl);
    if (!response.ok) throw new Error(`Catálogo indisponível: HTTP ${response.status}`);

    const payload = await response.json();
    state.catalog = Array.isArray(payload.revistas) ? payload.revistas : [];
    state.catalog.sort((a, b) =>
      Number(b.edition || 0) - Number(a.edition || 0)
    );

    document.querySelector("#site-title").textContent =
      payload.site?.title || "Acervo de Revistas";
    document.querySelector("#site-subtitle").textContent =
      payload.site?.subtitle || "Publicações para folhear online";
    document.title = payload.site?.title || "Acervo de Revistas";

    renderCatalog(state.catalog);
    openFromUrl();
  } catch (error) {
    console.error(error);
    elements.summary.textContent = "Não foi possível carregar o acervo.";
    elements.emptyState.hidden = false;
  }
}

function renderCatalog(magazines) {
  elements.grid.innerHTML = "";
  elements.emptyState.hidden = magazines.length > 0;
  elements.summary.textContent =
    magazines.length === 1
      ? "1 publicação disponível."
      : `${magazines.length} publicações disponíveis.`;

  for (const magazine of magazines) {
    const fragment = elements.template.content.cloneNode(true);
    const button = fragment.querySelector(".cover-button");
    const image = fragment.querySelector(".cover-image");
    const canvas = fragment.querySelector(".cover-canvas");
    const placeholder = fragment.querySelector(".cover-placeholder");
    const badge = fragment.querySelector(".format-badge");
    const title = fragment.querySelector(".card-title");
    const meta = fragment.querySelector(".card-meta");

    title.textContent = magazine.title;
    meta.textContent = buildMeta(magazine);
    badge.textContent =
      magazine.type === "pdf" ? "PDF" : `${magazine.pages?.length || 0} PÁG.`;
    button.setAttribute("aria-label", `Abrir ${magazine.title}`);
    button.addEventListener("click", () => openMagazine(magazine));

    if (magazine.cover) {
      image.src = assetUrl(magazine.cover);
      image.alt = `Capa de ${magazine.title}`;
      image.addEventListener(
        "load",
        () => {
          image.hidden = false;
          placeholder.hidden = true;
        },
        { once: true }
      );
      image.addEventListener(
        "error",
        () => {
          if (magazine.type === "pdf" && magazine.file) {
            renderPdfCover(magazine.file, canvas, placeholder);
          }
        },
        { once: true }
      );
    } else if (magazine.type === "pdf" && magazine.file) {
      renderPdfCover(magazine.file, canvas, placeholder);
    }

    elements.grid.appendChild(fragment);
  }
}

function buildMeta(magazine) {
  const parts = [];

  if (magazine.date) {
    const date = new Date(`${magazine.date}T12:00:00`);
    if (!Number.isNaN(date.getTime())) {
      parts.push(
        new Intl.DateTimeFormat("pt-BR", {
          month: "long",
          year: "numeric"
        }).format(date)
      );
    }
  }

  if (magazine.pagesCount) {
    parts.push(`${magazine.pagesCount} páginas`);
  } else if (magazine.type === "images" && magazine.pages?.length) {
    parts.push(`${magazine.pages.length} páginas`);
  }

  return (
    parts.join(" · ") ||
    (magazine.type === "pdf" ? "Documento PDF" : "Revista digital")
  );
}

async function renderPdfCover(file, canvas, placeholder) {
  try {
    const loadingTask = pdfjsLib.getDocument({ url: assetUrl(file) });
    const document = await loadingTask.promise;
    const page = await document.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const desiredWidth = 520;
    const viewport = page.getViewport({
      scale: desiredWidth / baseViewport.width
    });
    const context = canvas.getContext("2d", { alpha: false });

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;

    canvas.hidden = false;
    placeholder.hidden = true;
    await document.destroy();
  } catch (error) {
    console.warn("Capa do PDF não renderizada:", file, error);
  }
}

async function openMagazine(magazine, requestedPage = 1, updateHistory = true) {
  state.activeMagazine = magazine;
  state.currentPage = Math.max(1, Number(requestedPage) || 1);
  state.zoom = 1;
  state.pdfDocument = null;
  state.renderToken += 1;

  elements.title.textContent = magazine.title;
  elements.libraryView.hidden = true;
  elements.readerView.hidden = false;
  document.body.style.overflow = "hidden";

  if (updateHistory) {
    const url = new URL(window.location.href);
    url.searchParams.set("revista", magazine.slug);
    url.searchParams.set("pagina", state.currentPage);
    history.pushState({ magazine: magazine.slug }, "", url);
  }

  showLoading();

  if (magazine.type === "pdf") {
    try {
      const loadingTask = pdfjsLib.getDocument({
        url: assetUrl(magazine.file)
      });
      state.pdfDocument = await loadingTask.promise;
      state.totalPages = state.pdfDocument.numPages;
    } catch (error) {
      console.error(error);
      showPdfFallback(magazine.file);
      return;
    }
  } else {
    state.totalPages = magazine.pages?.length || 1;
  }

  state.currentPage = Math.min(state.currentPage, state.totalPages);
  syncControls();
  await renderCurrentPage();
  elements.stage.focus({ preventScroll: true });
}

function showPdfFallback(file) {
  elements.loading.replaceChildren();

  const message = document.createElement("strong");
  message.textContent = "Não foi possível carregar o leitor.";

  const detail = document.createElement("p");
  detail.textContent = "O PDF ainda pode ser aberto diretamente no navegador.";

  const link = document.createElement("a");
  link.href = assetUrl(file);
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Abrir PDF diretamente";

  elements.loading.append(message, detail, link);
  elements.loading.hidden = false;
}

async function closeReader({ updateHistory = true } = {}) {
  state.renderToken += 1;

  if (state.pdfDocument) {
    try {
      await state.pdfDocument.destroy();
    } catch {
      // Nothing else is required here.
    }
  }

  state.activeMagazine = null;
  state.pdfDocument = null;
  elements.readerView.hidden = true;
  elements.libraryView.hidden = false;
  elements.canvas.hidden = true;
  elements.image.hidden = true;
  document.body.style.overflow = "";

  if (updateHistory) {
    const url = new URL(window.location.href);
    url.searchParams.delete("revista");
    url.searchParams.delete("pagina");
    history.pushState({}, "", url);
  }
}

async function renderCurrentPage() {
  const token = ++state.renderToken;
  showLoading();

  try {
    if (state.activeMagazine.type === "pdf") {
      const page = await state.pdfDocument.getPage(state.currentPage);
      if (token !== state.renderToken) return;

      const viewportBase = page.getViewport({ scale: 1 });
      const maxWidth = Math.max(280, elements.stage.clientWidth - 80);
      const maxHeight = Math.max(300, elements.stage.clientHeight - 48);
      const scale = Math.min(
        maxWidth / viewportBase.width,
        maxHeight / viewportBase.height
      );
      const viewport = page.getViewport({
        scale: scale * window.devicePixelRatio
      });
      const context = elements.canvas.getContext("2d", { alpha: false });

      elements.canvas.width = Math.floor(viewport.width);
      elements.canvas.height = Math.floor(viewport.height);
      elements.canvas.style.width =
        `${Math.floor(viewport.width / window.devicePixelRatio)}px`;
      elements.canvas.style.height =
        `${Math.floor(viewport.height / window.devicePixelRatio)}px`;

      await page.render({ canvasContext: context, viewport }).promise;
      if (token !== state.renderToken) return;

      elements.canvas.hidden = false;
      elements.image.hidden = true;
    } else {
      const source = state.activeMagazine.pages[state.currentPage - 1];
      await loadImage(source);
      if (token !== state.renderToken) return;

      const dimensions = fitDimensions(
        elements.image.naturalWidth,
        elements.image.naturalHeight,
        Math.max(280, elements.stage.clientWidth - 80),
        Math.max(300, elements.stage.clientHeight - 48)
      );

      elements.image.style.width = `${dimensions.width}px`;
      elements.image.style.height = `${dimensions.height}px`;
      elements.image.alt =
        `${state.activeMagazine.title}, página ${state.currentPage}`;
      elements.image.hidden = false;
      elements.canvas.hidden = true;
    }

    elements.loading.hidden = true;
    applyZoom();
    syncControls();
    updateUrlPage();
  } catch (error) {
    console.error(error);
    elements.loading.textContent = "Não foi possível carregar esta página.";
    elements.loading.hidden = false;
  }
}

function fitDimensions(width, height, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.floor(width * ratio),
    height: Math.floor(height * ratio)
  };
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    elements.image.onload = () => resolve();
    elements.image.onerror = reject;
    elements.image.src = assetUrl(source);
  });
}

function showLoading() {
  elements.loading.textContent = "Carregando página...";
  elements.loading.hidden = false;
  elements.canvas.hidden = true;
  elements.image.hidden = true;
}

function syncControls() {
  elements.status.textContent =
    `Página ${state.currentPage} de ${state.totalPages}`;
  elements.slider.max = String(state.totalPages);
  elements.slider.value = String(state.currentPage);
  elements.previous.disabled = state.currentPage <= 1;
  elements.next.disabled = state.currentPage >= state.totalPages;
  elements.zoomReset.textContent = `${Math.round(state.zoom * 100)}%`;
}

function updateUrlPage() {
  const url = new URL(window.location.href);
  url.searchParams.set("pagina", state.currentPage);
  history.replaceState(
    { magazine: state.activeMagazine?.slug },
    "",
    url
  );
}

async function goToPage(pageNumber) {
  const nextPage = Math.min(
    Math.max(1, Number(pageNumber) || 1),
    state.totalPages
  );
  if (nextPage === state.currentPage) return;

  state.currentPage = nextPage;
  await renderCurrentPage();
}

function applyZoom() {
  elements.frame.style.transform = `scale(${state.zoom})`;
  syncControls();
}

function changeZoom(delta) {
  state.zoom = Math.min(
    2.5,
    Math.max(0.6, Math.round((state.zoom + delta) * 10) / 10)
  );
  applyZoom();
}

function openFromUrl() {
  const url = new URL(window.location.href);
  const slug = url.searchParams.get("revista");
  if (!slug) return;

  const magazine = state.catalog.find((item) => item.slug === slug);
  if (magazine) {
    openMagazine(
      magazine,
      url.searchParams.get("pagina") || 1,
      false
    );
  }
}

elements.search.addEventListener("input", (event) => {
  const term = event.target.value
    .trim()
    .toLocaleLowerCase("pt-BR");

  const filtered = state.catalog.filter((magazine) => {
    const haystack =
      `${magazine.title} ${magazine.description || ""}`
        .toLocaleLowerCase("pt-BR");
    return haystack.includes(term);
  });

  renderCatalog(filtered);
});

elements.back.addEventListener("click", () => closeReader());
elements.previous.addEventListener(
  "click",
  () => goToPage(state.currentPage - 1)
);
elements.next.addEventListener(
  "click",
  () => goToPage(state.currentPage + 1)
);
elements.slider.addEventListener(
  "input",
  (event) => goToPage(event.target.value)
);
elements.zoomOut.addEventListener("click", () => changeZoom(-0.1));
elements.zoomIn.addEventListener("click", () => changeZoom(0.1));
elements.zoomReset.addEventListener("click", () => {
  state.zoom = 1;
  applyZoom();
});

elements.fullscreen.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await elements.readerView.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
});

elements.stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") goToPage(state.currentPage - 1);
  if (event.key === "ArrowRight") goToPage(state.currentPage + 1);
  if (event.key === "Escape") closeReader();
  if (event.key === "+" || event.key === "=") changeZoom(0.1);
  if (event.key === "-") changeZoom(-0.1);
});

elements.stage.addEventListener(
  "touchstart",
  (event) => {
    state.touchStartX =
      event.changedTouches[0]?.clientX ?? null;
  },
  { passive: true }
);

elements.stage.addEventListener(
  "touchend",
  (event) => {
    if (state.touchStartX === null) return;

    const endX =
      event.changedTouches[0]?.clientX ?? state.touchStartX;
    const difference = endX - state.touchStartX;
    state.touchStartX = null;

    if (Math.abs(difference) < 55) return;
    if (difference > 0) goToPage(state.currentPage - 1);
    else goToPage(state.currentPage + 1);
  },
  { passive: true }
);

window.addEventListener("resize", () => {
  if (state.activeMagazine) renderCurrentPage();
});

window.addEventListener("popstate", () => {
  const url = new URL(window.location.href);
  const slug = url.searchParams.get("revista");

  if (!slug) {
    closeReader({ updateHistory: false });
    return;
  }

  const magazine = state.catalog.find((item) => item.slug === slug);

  if (
    magazine &&
    (!state.activeMagazine ||
      magazine.slug !== state.activeMagazine.slug)
  ) {
    openMagazine(
      magazine,
      url.searchParams.get("pagina") || 1,
      false
    );
  } else if (magazine) {
    goToPage(url.searchParams.get("pagina") || 1);
  }
});

elements.theme.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
});

const storedTheme = localStorage.getItem("theme");
if (storedTheme) {
  document.documentElement.dataset.theme = storedTheme;
}

loadCatalog();
