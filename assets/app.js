const state = {
  catalog: [],
  activeMagazine: null,
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
  image: document.querySelector("#image-page"),
  loading: document.querySelector("#reader-loading"),
  previous: document.querySelector("#previous-page"),
  next: document.querySelector("#next-page"),
  back: document.querySelector("#reader-back"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomReset: document.querySelector("#zoom-reset"),
  fullscreen: document.querySelector("#fullscreen-button"),
  openPdf: document.querySelector("#open-pdf"),
  theme: document.querySelector("#theme-toggle")
};

function assetUrl(assetPath) {
  const normalized = String(assetPath || "")
    .replaceAll("\\", "/");

  const encoded = normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return new URL(encoded, document.baseURI).href;
}

async function loadCatalog() {
  try {
    const catalogUrl = new URL(
      `data/revistas.json?v=${Date.now()}`,
      document.baseURI
    );

    const response = await fetch(catalogUrl);

    if (!response.ok) {
      throw new Error(
        `Catálogo indisponível: HTTP ${response.status}`
      );
    }

    const payload = await response.json();

    state.catalog = Array.isArray(payload.revistas)
      ? payload.revistas
      : [];

    document.querySelector("#site-title").textContent =
      payload.site?.title || "CC Masters Zine";

    document.querySelector("#site-subtitle").textContent =
      payload.site?.subtitle ||
      "Revistas da comunidade para folhear online";

    document.title =
      payload.site?.title || "CC Masters Zine";

    renderCatalog(state.catalog);
    openFromUrl();
  } catch (error) {
    console.error(error);
    elements.summary.textContent =
      "Não foi possível carregar o acervo.";
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
    const fragment =
      elements.template.content.cloneNode(true);

    const button =
      fragment.querySelector(".cover-button");
    const image =
      fragment.querySelector(".cover-image");
    const placeholder =
      fragment.querySelector(".cover-placeholder");
    const badge =
      fragment.querySelector(".format-badge");
    const title =
      fragment.querySelector(".card-title");
    const meta =
      fragment.querySelector(".card-meta");

    title.textContent = magazine.title;
    meta.textContent =
      `${magazine.pagesCount || magazine.pages?.length || 0} páginas`;
    badge.textContent = "REVISTA";

    button.setAttribute(
      "aria-label",
      `Abrir ${magazine.title}`
    );

    button.addEventListener(
      "click",
      () => openMagazine(magazine)
    );

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

    elements.grid.appendChild(fragment);
  }
}

async function openMagazine(
  magazine,
  requestedPage = 1,
  updateHistory = true
) {
  state.activeMagazine = magazine;
  state.currentPage = Math.max(
    1,
    Number(requestedPage) || 1
  );
  state.totalPages = magazine.pages?.length || 1;
  state.currentPage = Math.min(
    state.currentPage,
    state.totalPages
  );
  state.zoom = 1;
  state.renderToken += 1;

  elements.title.textContent = magazine.title;
  elements.libraryView.hidden = true;
  elements.readerView.hidden = false;
  document.body.style.overflow = "hidden";

  if (magazine.pdf) {
    elements.openPdf.href = assetUrl(magazine.pdf);
    elements.openPdf.hidden = false;
  } else {
    elements.openPdf.hidden = true;
  }

  if (updateHistory) {
    const url = new URL(window.location.href);
    url.searchParams.set("revista", magazine.slug);
    url.searchParams.set("pagina", state.currentPage);

    history.pushState(
      { magazine: magazine.slug },
      "",
      url
    );
  }

  syncControls();
  await renderCurrentPage();
  elements.stage.focus({ preventScroll: true });
}

function closeReader({ updateHistory = true } = {}) {
  state.renderToken += 1;
  state.activeMagazine = null;

  elements.readerView.hidden = true;
  elements.libraryView.hidden = false;
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
    const source =
      state.activeMagazine.pages[state.currentPage - 1];

    await loadImage(source);

    if (token !== state.renderToken) return;

    const dimensions = fitDimensions(
      elements.image.naturalWidth,
      elements.image.naturalHeight,
      Math.max(280, elements.stage.clientWidth - 80),
      Math.max(300, elements.stage.clientHeight - 48)
    );

    elements.image.style.width =
      `${dimensions.width}px`;
    elements.image.style.height =
      `${dimensions.height}px`;

    elements.image.alt =
      `${state.activeMagazine.title}, página ${state.currentPage}`;

    elements.image.hidden = false;
    elements.loading.hidden = true;

    applyZoom();
    syncControls();
    updateUrlPage();
  } catch (error) {
    console.error(error);
    elements.loading.textContent =
      "Não foi possível carregar esta página.";
    elements.loading.hidden = false;
  }
}

function fitDimensions(
  width,
  height,
  maxWidth,
  maxHeight
) {
  const ratio = Math.min(
    maxWidth / width,
    maxHeight / height,
    1
  );

  return {
    width: Math.floor(width * ratio),
    height: Math.floor(height * ratio)
  };
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    elements.image.onload = resolve;
    elements.image.onerror = reject;
    elements.image.src = assetUrl(source);
  });
}

function showLoading() {
  elements.loading.textContent =
    "Carregando página...";
  elements.loading.hidden = false;
  elements.image.hidden = true;
}

function syncControls() {
  elements.status.textContent =
    `Página ${state.currentPage} de ${state.totalPages}`;

  elements.slider.max =
    String(state.totalPages);
  elements.slider.value =
    String(state.currentPage);

  elements.previous.disabled =
    state.currentPage <= 1;
  elements.next.disabled =
    state.currentPage >= state.totalPages;

  elements.zoomReset.textContent =
    `${Math.round(state.zoom * 100)}%`;
}

function updateUrlPage() {
  const url = new URL(window.location.href);
  url.searchParams.set(
    "pagina",
    state.currentPage
  );

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
  elements.frame.style.transform =
    `scale(${state.zoom})`;
  syncControls();
}

function changeZoom(delta) {
  state.zoom = Math.min(
    2.5,
    Math.max(
      0.6,
      Math.round((state.zoom + delta) * 10) / 10
    )
  );

  applyZoom();
}

function openFromUrl() {
  const url = new URL(window.location.href);
  const slug = url.searchParams.get("revista");

  if (!slug) return;

  const magazine = state.catalog.find(
    (item) => item.slug === slug
  );

  if (magazine) {
    openMagazine(
      magazine,
      url.searchParams.get("pagina") || 1,
      false
    );
  }
}

elements.search.addEventListener(
  "input",
  (event) => {
    const term = event.target.value
      .trim()
      .toLocaleLowerCase("pt-BR");

    const filtered = state.catalog.filter(
      (magazine) =>
        magazine.title
          .toLocaleLowerCase("pt-BR")
          .includes(term)
    );

    renderCatalog(filtered);
  }
);

elements.back.addEventListener(
  "click",
  () => closeReader()
);

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

elements.zoomOut.addEventListener(
  "click",
  () => changeZoom(-0.1)
);

elements.zoomIn.addEventListener(
  "click",
  () => changeZoom(0.1)
);

elements.zoomReset.addEventListener(
  "click",
  () => {
    state.zoom = 1;
    applyZoom();
  }
);

elements.fullscreen.addEventListener(
  "click",
  async () => {
    if (!document.fullscreenElement) {
      await elements.readerView.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }
);

elements.stage.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "ArrowLeft") {
      goToPage(state.currentPage - 1);
    }

    if (event.key === "ArrowRight") {
      goToPage(state.currentPage + 1);
    }

    if (event.key === "Escape") {
      closeReader();
    }

    if (
      event.key === "+" ||
      event.key === "="
    ) {
      changeZoom(0.1);
    }

    if (event.key === "-") {
      changeZoom(-0.1);
    }
  }
);

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
      event.changedTouches[0]?.clientX ??
      state.touchStartX;

    const difference =
      endX - state.touchStartX;

    state.touchStartX = null;

    if (Math.abs(difference) < 55) return;

    if (difference > 0) {
      goToPage(state.currentPage - 1);
    } else {
      goToPage(state.currentPage + 1);
    }
  },
  { passive: true }
);

window.addEventListener(
  "resize",
  () => {
    if (state.activeMagazine) {
      renderCurrentPage();
    }
  }
);

window.addEventListener(
  "popstate",
  () => {
    const url =
      new URL(window.location.href);

    const slug =
      url.searchParams.get("revista");

    if (!slug) {
      closeReader({
        updateHistory: false
      });
      return;
    }

    const magazine =
      state.catalog.find(
        (item) => item.slug === slug
      );

    if (
      magazine &&
      (
        !state.activeMagazine ||
        magazine.slug !==
          state.activeMagazine.slug
      )
    ) {
      openMagazine(
        magazine,
        url.searchParams.get("pagina") || 1,
        false
      );
    } else if (magazine) {
      goToPage(
        url.searchParams.get("pagina") || 1
      );
    }
  }
);

elements.theme.addEventListener(
  "click",
  () => {
    const current =
      document.documentElement.dataset.theme;

    const next =
      current === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme =
      next;

    localStorage.setItem("theme", next);
  }
);

const storedTheme =
  localStorage.getItem("theme");

if (storedTheme) {
  document.documentElement.dataset.theme =
    storedTheme;
}

loadCatalog();
