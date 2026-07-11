(() => {
  const payload = {"version":1,"generatedAt":"2026-07-11T01:31:06.697Z","siteUrl":"https://revista.cianortecardmasters.com.br","latest":{"edition":"001","number":1,"slug":"edicao-001","title":"Edição 001","pagesCount":24,"cover":"https://revista.cianortecardmasters.com.br/data/edicoes/001/001.jpg","url":"https://revista.cianortecardmasters.com.br/?revista=edicao-001&pagina=1","pdf":"https://revista.cianortecardmasters.com.br/revistas/001.pdf"}};
  globalThis.CCMastersZineLatest = payload;
  globalThis.dispatchEvent?.(
    new CustomEvent("ccmasters-zine:latest", {
      detail: payload
    })
  );
})();
