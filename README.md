# Painel de Indicadores — Lyra M2M

Baseline navegável do Painel de Indicadores usado para validar conteúdo, organização e aparência. Nesta etapa, todos os números são fictícios e os filtros são ilustrativos.

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

## Testes

```powershell
npm.cmd test
```

O seam de teste é o Painel carregado no navegador. O teste observa abertura, aviso permanente de dados fictícios, seis áreas navegáveis e comportamento por teclado usando papéis e nomes acessíveis. Ele não depende da estrutura interna do CSS e não substitui a inspeção visual em 16:9 e 1366 × 768.

## Documentação do produto

- O vocabulário canônico está em `GLOSSARY.md`.
- A especificação está em `docs/specs/painel-de-indicadores.md`.
