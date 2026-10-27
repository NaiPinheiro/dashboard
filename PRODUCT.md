# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

HTML, CSS e JavaScript sem framework, servidos por um processo Node.js local restrito a `127.0.0.1`. A versão funcional lê sete arquivos agregados canônicos e um manifesto em uma Pasta de Dados local, valida cada conjunto de forma independente e mantém um cache local da última carga válida, sem conexão direta com banco, API ou outro aplicativo.

## Users

A usuária principal é uma gerente de produto da Lyra M2M que apresenta, quinzenal e mensalmente, indicadores de produto para liderança e áreas interessadas. Durante a apresentação, ela precisa conduzir uma narrativa única sem alternar entre Grafana, planilhas e slides.

## Product Purpose

Consolidar indicadores de usuários, acessos, empresas, telas, Loja, pedidos e franquias em uma experiência visual coerente. O baseline visual já foi aprovado; a evolução funcional acontece em fatias verticais, começando pela Carga Manual de Dados de Usuários.

## Positioning

O Painel de Indicadores organiza em uma mesma narrativa os indicadores da Lyra M2M em Portal, Loja, Aplicativo e pedidos. A Lyra Network não faz parte do dashboard.

## Operating Context

- Apresentação ao vivo em tela 16:9, com adaptação para notebook.
- Consulta quinzenal ou mensal, abrindo no último mês fechado.
- Comparação com o período equivalente imediatamente anterior.
- Visão consolidada da Lyra M2M ou separada por Produto Digital.
- Audiência de liderança, comercial, marketing e demais áreas interessadas.

## Capabilities and Constraints

- Seis abas navegáveis: Visão geral; Usuários e Acessos; Empresas; Telas; Loja e Pedidos; Desenvolvimento.
- Usuários, Acessos, Empresas Clientes e Telas aceitam agregados anonimizados aderentes aos contratos da Pasta de Dados; Loja, Pedidos, Franquias, Baixas de Usuário e suspensões recentes permanecem indisponíveis até receberem fontes adequadas.
- Os filtros de Período de Análise e Produto Digital recalculam somente combinações sustentadas pelos arquivos validados; lacunas permanecem não informadas.
- A Carga Manual de Dados não realiza conexão direta com sistemas externos e preserva a última versão válida por conjunto.
- A área de Desenvolvimento permanece “em definição”, sem métricas inventadas.
- O baseline visual aprovado permanece preservado; a validação funcional cobre carga, navegação, proveniência, estados e lacunas.
- O vocabulário canônico está em `GLOSSARY.md`.
- As regras completas estão em `ESPECIFICACAO_MVP.md`.

## Brand Commitments

- Direção corporativa clara.
- Azul escuro como cor estrutural.
- Cartões claros e poucos destaques cromáticos.
- Linguagem direta, executiva e sem jargão técnico desnecessário.

## Evidence on Hand

Não há logotipo nem identidade visual detalhada aprovada além do baseline atual. Os conjuntos funcionais podem usar somente agregados anonimizados aderentes aos contratos; arquivos brutos e PII não entram no painel nem no Git. Áreas ainda sem contrato permanecem indisponíveis, sem números inventados, e ilustrações nunca devem ser apresentadas como capturas reais do produto.

## Product Principles

1. Uma narrativa substitui a troca de ferramentas durante a apresentação.
2. Cada número deve ter significado inequívoco e comparação legível.
3. Arquivo ou campo ausente deve ser informado como indisponível, nunca interpretado como zero.
4. Dados fictícios devem parecer plausíveis sem se passar por evidência real.
5. O primeiro MVP valida a decisão visual antes de aumentar a manutenção técnica.

## Accessibility & Inclusion

A interface deve permanecer legível à distância, usar texto e ícones além de cor para comunicar variações e oferecer foco visível na navegação por teclado.
