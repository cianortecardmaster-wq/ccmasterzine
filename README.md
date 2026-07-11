# CC Masters Zine

O site usa PDFs numerados em ordem:

```text
revistas/
├── 001.pdf
├── 002.pdf
├── 003.pdf
└── ...
```

## Como funciona

Ao publicar uma alteração, o GitHub Actions:

1. encontra os PDFs numerados;
2. converte todas as páginas para imagens JPG;
3. usa a primeira página como capa;
4. monta o catálogo;
5. publica o leitor no GitHub Pages.

O PDF original também permanece disponível pelo botão `PDF` dentro do leitor.

Essa conversão evita problemas de compatibilidade do PDF.js com imagens JPEG 2000 presentes em alguns PDFs exportados pelo Canva ou processados por outros serviços.

## Publicar uma nova edição

Envie apenas o próximo arquivo para a pasta `revistas/`.

Exemplo:

```text
revistas/002.pdf
```

Não é necessário editar o catálogo nem gerar a capa manualmente.

## GitHub Pages

Em `Settings → Pages`, mantenha:

```text
Source: GitHub Actions
```
