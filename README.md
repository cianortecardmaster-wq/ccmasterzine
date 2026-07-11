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
5. identifica automaticamente a edição de maior número;
6. gera os arquivos de integração da última edição;
7. publica o leitor no GitHub Pages.

O PDF original também permanece disponível pelo botão `PDF` dentro do leitor.

Essa conversão evita problemas de compatibilidade do PDF.js com imagens JPEG 2000 presentes em alguns PDFs exportados pelo Canva ou processados por outros serviços.

## Publicar uma nova edição

Envie apenas o próximo arquivo para a pasta `revistas/`.

Exemplo:

```text
revistas/002.pdf
```

Não é necessário editar o catálogo, criar a capa nem atualizar o Mesa 42 manualmente.

O gerador organiza as edições da maior para a menor. Assim, quando `002.pdf` for publicado, a edição 002 será a mais recente. Depois, `003.pdf` assumirá automaticamente esse lugar, e assim por diante.

## Integração com o Mesa 42

A publicação gera automaticamente dois endereços:

```text
https://revista.cianortecardmasters.com.br/data/latest.json
https://revista.cianortecardmasters.com.br/data/latest.js
```

O arquivo `latest.json` contém os dados da edição atual. O arquivo `latest.js` oferece os mesmos dados em um formato que pode ser carregado por outro subdomínio sem depender de permissões CORS.

Estrutura disponibilizada:

```json
{
  "version": 1,
  "generatedAt": "data da publicação",
  "siteUrl": "https://revista.cianortecardmasters.com.br",
  "latest": {
    "edition": "001",
    "number": 1,
    "slug": "edicao-001",
    "title": "Edição 001",
    "pagesCount": 24,
    "cover": "endereço absoluto da capa",
    "url": "endereço que abre a edição no leitor",
    "pdf": "endereço do PDF"
  }
}
```

Os números acima são apenas um exemplo do formato. Os arquivos são recriados pelo GitHub Actions em cada publicação e sempre passam a apontar para o PDF de maior número.

## GitHub Pages

Em `Settings → Pages`, mantenha:

```text
Source: GitHub Actions
```
