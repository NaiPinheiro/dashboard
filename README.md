# Painel de Indicadores — Lyra M2M

Baseline navegável do Painel de Indicadores, agora com a primeira fatia funcional de Carga Manual de Dados. Os indicadores de Usuários podem usar agregados anonimizados validados; as demais áreas continuam com dados fictícios e os filtros permanecem ilustrativos.

## Requisitos

- Node.js 20 ou posterior;
- npm;
- Google Chrome para os testes locais de navegador.

## Instalação

```powershell
npm.cmd install
```

## Executar o painel

```powershell
npm.cmd start
```

Abra [http://127.0.0.1:8792/painel.html](http://127.0.0.1:8792/painel.html). O servidor aceita conexões somente no computador local.

## Carregar dados de Usuários

Por padrão, o servidor procura uma pasta local chamada `dados`. Ela não é versionada. Também é possível indicar outra pasta antes de iniciar:

```powershell
$env:DATA_DIR = 'C:\caminho\para\Pasta de Dados'
npm.cmd start
```

A pasta deve conter estes arquivos UTF-8, delimitados por ponto e vírgula:

- `manifesto_carga.csv`;
- `usuarios.csv`;
- `usuarios_inatividade.csv`.

Os exemplos fictícios usados pelos testes estão em `tests/fixtures/carga-usuarios-valida`. Eles mostram os cabeçalhos e os tipos de registro aceitos sem expor dados corporativos.

A carga é validada integralmente antes da ativação. Cabeçalhos incompatíveis, colunas extras, chaves duplicadas, datas inválidas, totais negativos e identificadores que se pareçam com PII são rejeitados. O cache local em `.painel-cache` guarda somente os agregados validados e preserva a última versão válida quando uma nova tentativa falha.

Nunca adicione arquivos reais da Pasta de Dados ao Git.

## Testes

```powershell
npm.cmd test
```

O seam de teste é o Painel carregado no navegador. O teste observa abertura, aviso permanente de dados fictícios, seis áreas navegáveis e comportamento por teclado usando papéis e nomes acessíveis. Ele não depende da estrutura interna do CSS e não substitui a inspeção visual em 16:9 e 1366 × 768.

## Documentação do produto

- O vocabulário canônico está em `GLOSSARY.md`.
- A especificação está em `docs/specs/painel-de-indicadores.md`.
