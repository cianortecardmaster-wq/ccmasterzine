# Acervo de Revistas

Site estático para GitHub Pages. A página inicial mostra as capas das revistas e abre um leitor com navegação por páginas.

## Como adicionar uma revista

### Opção 1 — PDF

Coloque o arquivo diretamente dentro da pasta `revistas/`.

Exemplo:

```text
revistas/
└── revista-numero-01.pdf
```

A primeira página do PDF será usada como capa.

### Opção 2 — Imagens

Crie uma pasta para a revista e coloque as páginas dentro dela, em ordem numérica.

```text
revistas/
└── revista-numero-02/
    ├── 001-capa.jpg
    ├── 002.jpg
    ├── 003.jpg
    └── 004.jpg
```

Use nomes com números no início para garantir a ordem correta.

## Metadados opcionais

Dentro da pasta da revista, pode existir um arquivo `meta.json`:

```json
{
  "title": "Revista Número 02",
  "description": "Descrição usada na pesquisa.",
  "date": "2026-07-10",
  "cover": "001-capa.jpg"
}
```

Para uma pasta que contém PDF, também é possível indicar `"file": "revista.pdf"`.

## Publicação no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos estes arquivos para a branch `main`.
3. Abra **Settings → Pages**.
4. Em **Build and deployment → Source**, escolha **GitHub Actions**.
5. Faça um novo commit ou execute manualmente o workflow **Publicar acervo no GitHub Pages**.

Depois disso, para publicar novas revistas, basta enviar os PDFs ou imagens para `revistas/`. O workflow reconstrói o catálogo automaticamente.

## Personalização

Edite `data/revistas.json` para alterar o nome inicial do site:

```json
{
  "site": {
    "title": "Meu Acervo",
    "subtitle": "Revistas, catálogos e publicações"
  }
}
```

O gerador preserva esses dois campos.

As cores e aparência ficam em `assets/styles.css`.

## Recursos

- leitor de PDF;
- revistas formadas por imagens;
- capa automática;
- pesquisa;
- navegação com setas do teclado;
- swipe em celular;
- zoom;
- tela cheia;
- link direto para revista e página;
- tema claro e escuro;
- catálogo gerado automaticamente no GitHub Actions.
