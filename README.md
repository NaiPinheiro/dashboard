# Painel de Indicadores — Lyra M2M

Painel funcional e navegável com Carga Manual de Dados por arquivos agregados, sintéticos ou anonimizados. A validação acontece por arquivo, preserva o último cache válido e mantém lacunas sem fonte como indisponíveis, nunca como zero.

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

## Carregar a Pasta de Dados

Por padrão, o servidor procura uma pasta local chamada `dados`. Ela não é versionada nem servida por HTTP. Também é possível indicar outra pasta antes de iniciar:

```powershell
$env:DATA_DIR = 'C:\caminho\para\Pasta de Dados'
npm.cmd start
```

A pasta aceita estes arquivos UTF-8 delimitados por ponto e vírgula:

- `manifesto_carga.csv`;
- `usuarios.csv`;
- `usuarios_inatividade.csv`;
- `acessos.csv`;
- `ranking_acessos.csv`;
- `empresas.csv`;
- `telas_aplicativo.csv`;
- `telas_portal.csv`, opcional e parcial.

O manifesto declara contrato, geração, abrangência, parcialidade, origem, estado e observação de cada fonte. Os exemplos de teste em `tests/fixtures/carga-usuarios-valida` são integralmente sintéticos e anônimos. Nunca adicione arquivos reais da Pasta de Dados ao Git.

### Validação e cache

A carga valida cada arquivo integralmente e ativa somente os conjuntos válidos. Cabeçalho incompatível, coluna extra, chave duplicada, data inválida, total negativo, inconsistência entre totais e PII conhecida causam rejeição apenas daquele arquivo.

O cache local em `.painel-cache` guarda somente agregados validados:

- `ready`: todos os arquivos necessários do conjunto foram validados nesta carga;
- `stale`: a tentativa atual falhou ou o arquivo não foi atualizado, mas a última versão válida continua ativa;
- `partial`: somente parte de um conjunto composto possui versão válida;
- `unavailable`: não existe versão válida para o conjunto.

Arquivo ausente ou ausente do manifesto gera aviso de fonte não atualizada. Uma rejeição registra somente nome do arquivo, data da tentativa e motivos de validação; o conteúdo das linhas não é copiado. Campo vazio, `\N`, zero explícito e indisponibilidade permanecem estados distintos.

Loja, Pedidos, Franquias, Baixas de Usuário e suspensões recentes continuam sem números até receberem contratos e fontes adequados. Sessões e eventos do Microsoft Clarity não são convertidos em Visualizações de Tela, e o evento `login` do Google Analytics não substitui Acesso.

### Fronteira HTTP

O servidor escuta exclusivamente em `127.0.0.1`. Somente `painel.html`, ativos públicos permitidos e os endpoints agregados do painel ficam acessíveis. Pasta de Dados, `.painel-cache`, documentação e testes retornam `404` e não devem ser publicados.

## Testes

A validação usa o Painel e seus endpoints agregados pelo navegador, sem depender da estrutura interna do CSS. Para executar somente a validação integrada da Issue #9:

```powershell
npm.cmd test -- --grep "Issue #9"
```

Esses testes copiam fixtures sintéticos para `tests/.data`, usam `tests/.cache` isolado e verificam:

- carga dos sete arquivos canônicos e do manifesto;
- ativação independente quando outro arquivo está ausente ou inválido;
- preservação de caches válidos;
- estados `ready`, `stale`, `partial` e `unavailable`;
- rejeições com arquivo, data e motivos, sem conteúdo de linha;
- metadados visíveis por fonte e lacunas sem números inventados.

Para a suíte completa, fora desta fase direcionada:

```powershell
npm.cmd test
```

A validação visual da Issue #9 captura uma evidência PNG de cada uma das seis abas em 1920 × 1080 e 1366 × 768. As doze capturas ficam como anexos do teste em `test-results` e são renovadas a cada execução direcionada. O mesmo teste verifica, no DOM público, se o título permanece no viewport, se cartões e tabelas respeitam os limites horizontais, se o conteúdo não excede o cartão e se os itens das grades não se sobrepõem.

## Documentação do produto

- O vocabulário canônico está em `GLOSSARY.md`.
- A especificação está em `docs/specs/painel-de-indicadores.md`.
