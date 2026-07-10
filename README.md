# Acervo de Revistas

Site estático para GitHub Pages, com vitrine de capas e leitor de PDF.

## Como publicar as edições

Envie os PDFs para a pasta `revistas/`, usando sempre três números:

```text
revistas/
├── 001.pdf
├── 002.pdf
├── 003.pdf
├── 004.pdf
└── ...
```

Não coloque título, espaços ou acentos no nome do arquivo.

Cada novo envio executa automaticamente estas etapas:

1. gera a capa usando a primeira página do PDF;
2. atualiza a página inicial;
3. mostra a edição de maior número primeiro;
4. publica novamente o site no GitHub Pages.

O arquivo `002.pdf` será exibido como **Edição 002**, o `003.pdf` como **Edição 003** e assim por diante.

## GitHub Pages

Em `Settings → Pages → Build and deployment → Source`, mantenha selecionado:

```text
GitHub Actions
```
