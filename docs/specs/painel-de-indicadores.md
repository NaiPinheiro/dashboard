## Problem Statement

A gerente de produto precisa apresentar, quinzenal e mensalmente, indicadores da Lyra M2M para liderança e áreas interessadas. Hoje, a narrativa depende da alternância entre ferramentas, planilhas e telas diferentes, o que dificulta comparar períodos, distinguir conceitos próximos e conduzir a reunião de forma clara. Antes de investir em integrações e cálculos definitivos, é necessário validar visualmente quais indicadores entram no Painel de Indicadores, como eles se organizam e se a leitura funciona em apresentação 16:9 e em notebook.

## Solution

Criar um MVP do Painel visual e navegável, executado localmente no navegador, que reúna em seis abas os indicadores aprovados de usuários, acessos, Empresas Clientes, telas, Loja, pedidos e franquias. O painel usará dados fixos, plausíveis e integralmente fictícios, com treze meses de histórico e aviso permanente sobre sua natureza demonstrativa. Os filtros serão visíveis e comunicarão a experiência pretendida, mas não recalcularão os dados. A entrega permite validar conteúdo, organização, hierarquia e aparência antes da implementação da Carga Manual de Dados, dos cálculos funcionais, das exportações e da implantação.

## User Stories

1. Como gerente de produto, quero abrir o painel no último mês fechado, para apresentar um período estável que não mude durante a reunião.
2. Como gerente de produto, quero visualizar uma alternativa de quinzena, para demonstrar como consultas quinzenais serão representadas futuramente.
3. Como gerente de produto, quero comparar o Período de Análise com o intervalo equivalente imediatamente anterior, para contextualizar aumentos e quedas.
4. Como participante da reunião, quero ver diferença absoluta e variação percentual lado a lado, para entender tanto a magnitude quanto a proporção da mudança.
5. Como participante da reunião, quero que variações usem texto e ícones além de cor, para interpretar o resultado sem depender apenas da percepção cromática.
6. Como gerente de produto, quero alternar entre seis abas sem trocar de arquivo ou ferramenta, para conduzir uma narrativa contínua.
7. Como usuária de teclado, quero navegar entre as abas com setas, Home e End, para operar o painel sem depender do mouse.
8. Como gerente de produto, quero uma Visão geral equilibrada, para iniciar a apresentação com usuários, acessos, empresas, suspensões e pedidos.
9. Como gerente de produto, quero ver separadamente total de usuários, novos usuários, baixas e usuários inativos, para não confundir estoque, entrada, saída e falta de uso.
10. Como participante da reunião, quero entender que Novo Usuário é uma conta criada no período, para não confundir criação com primeiro acesso.
11. Como participante da reunião, quero entender que Baixa de Usuário é uma conta desativada ou excluída, para não confundir baixa com inatividade.
12. Como gerente de produto, quero identificar Usuários Inativos sem acesso nos 30 dias anteriores, para acompanhar falta recente de uso.
13. Como gerente de produto, quero ver logins totais e usuários únicos lado a lado, para distinguir intensidade de uso e alcance.
14. Como gerente de produto, quero um ranking de Empresas Clientes ordenado por logins, para identificar quem mais utiliza os Produtos Digitais.
15. Como gerente de produto, quero ver usuários únicos junto ao ranking de acessos, para contextualizar se o volume está concentrado em poucas pessoas.
16. Como gerente de produto, quero visualizar Empresas Clientes ativas, inativas e suspensas separadamente, para não tratar estados diferentes como equivalentes.
17. Como gerente de produto, quero que Empresa Inativa siga o critério combinado de ausência de acesso e status inativo, para evitar falsos positivos.
18. Como gerente de produto, quero um cartão próprio para empresas suspensas por inadimplência nos últimos 30 dias, para acompanhar esse risco independentemente do Período de Análise.
19. Como gerente de produto, quero ver as Empresas Clientes que mais criaram usuários no período, para reconhecer expansão de uso dentro da base.
20. Como gerente de produto, quero visualizar telas por total de visualizações, para usar a granularidade realmente disponível nas fontes analíticas previstas.
21. Como participante da reunião, quero que visualizações de tela não sejam apresentadas como usuários únicos, para não inferir uma medição que não existe.
22. Como gerente de produto, quero separar visualmente Portal e Aplicativo, para comparar Produtos Digitais sem misturar suas fontes e contextos.
23. Como gerente de produto, quero ver logins, usuários únicos e Empresas Clientes que acessaram a Loja, para entender intensidade, alcance e adoção empresarial.
24. Como gerente de produto, quero relacionar acesso à Loja e Pedidos do Cliente, para apresentar a jornada comercial de forma coerente.
25. Como gerente de produto, quero distinguir Pedido do Cliente de Pedido Comercial, para entender por qual canal cada pedido foi criado.
26. Como gerente de produto, quero ver cancelamentos separados dos pedidos criados, para não misturar entrada de demanda com perdas posteriores.
27. Como gerente de produto, quero ranquear Franquias Compradas pela quantidade de chips em pedidos não cancelados, para representar corretamente o volume contratado.
28. Como gerente de produto, quero ranquear Franquias Canceladas pela quantidade de chips e pela data do cancelamento, para atribuir a perda ao período correto.
29. Como gerente de produto, quero treze meses de histórico fictício, para demonstrar tendência anual e comparação mensal.
30. Como participante da reunião, quero um aviso permanente de dados fictícios, para não interpretar nomes ou números demonstrativos como dados reais da Lyra.
31. Como responsável pela privacidade, quero que nenhum nome de cliente real seja usado, para evitar exposição ou associação indevida.
32. Como gerente de produto, quero dados matematicamente coerentes entre cartões, rankings e gráficos, para que a demonstração seja crível.
33. Como gerente de produto, quero filtros de período e Produto Digital visíveis, para validar a experiência futura de consulta.
34. Como participante da reunião, quero ser avisado quando um filtro ilustrativo for alterado, para saber que os números ainda não são recalculados.
35. Como gerente de produto, quero uma área de Desenvolvimento marcada como “Indicadores em definição”, para reservar o espaço sem inventar métricas ainda não aprovadas.
36. Como participante da reunião, quero uma hierarquia visual legível à distância, para acompanhar a apresentação em tela 16:9.
37. Como gerente de produto, quero que o painel continue legível em notebook, para poder apresentar fora de uma sala equipada.
38. Como usuária sensível a movimento, quero que animações sejam desativadas quando houver preferência por movimento reduzido, para usar o painel com conforto.
39. Como responsável pelo produto, quero aprovar conteúdo, organização e aparência antes de integrações, para reduzir retrabalho técnico.
40. Como gerente de produto, quero fornecer os dados por arquivos em uma Pasta de Dados, para atualizar o painel sem conexão direta com sistemas corporativos.
41. Como responsável pela operação, quero que arquivos ausentes ou inválidos sejam sinalizados sem apagar a última carga válida, para evitar indicadores incorretos.

## Implementation Decisions

- O MVP será uma aplicação web estática, autocontida e executável localmente, usando HTML, CSS e JavaScript sem framework, backend, banco de dados ou dependências externas.
- A navegação será organizada em seis áreas: Visão geral; Usuários e Acessos; Empresas; Telas; Loja e Pedidos; Desenvolvimento.
- A navegação por abas usará semântica acessível de tablist, tab e tabpanel, com foco visível e suporte a teclado.
- Os filtros de Período de Análise e Produto Digital serão ilustrativos. Uma mensagem de status explicará que a alteração não recalcula os dados.
- O conjunto demonstrativo será fixo, integralmente fictício e internamente coerente, cobrindo treze meses.
- A abertura padrão representará o último mês fechado e sua comparação com o período anterior.
- A Visão geral combinará métricas de usuários, acessos, Empresas Clientes, inadimplência e pedidos com uma tendência histórica e pontos de atenção.
- Conceitos de domínio seguirão o vocabulário canônico: Empresa Cliente, Produto Digital, Período de Análise, Usuário Inativo, Empresa Inativa, Empresa Suspensa por Inadimplência, Pedido do Cliente, Pedido Comercial e Franquia de Dados.
- O dashboard cobrirá exclusivamente a Lyra M2M, com Portal, Loja, Aplicativo e pedidos. A Lyra Network não fará parte da interface nem dos filtros.
- Visualização de Tela será mostrada apenas como volume agregado; não haverá atribuição a usuários únicos.
- Suspensões por inadimplência usarão uma janela móvel de 30 dias independente do filtro principal.
- A direção visual será corporativa clara, com azul escuro estrutural, cartões claros, poucos destaques cromáticos e comparações compreensíveis à distância.
- O layout usará grades fluidas, rolagem horizontal segura para as abas e pontos de adaptação para apresentação ampla, notebook, tablet e celular.
- A interface respeitará a preferência de movimento reduzido.
- A Área de Desenvolvimento permanecerá sem indicadores numéricos até uma especificação posterior.
- A versão funcional receberá arquivos colocados manualmente em uma Pasta de Dados local e não terá conexão direta com banco, API, Clarity, Google Analytics ou outro aplicativo.
- A versão funcional seguirá os contratos versionados em `docs/data/CONTRATOS_PASTA_DADOS_V1.md`, definidos a partir das fontes reais inspecionadas.
- Nenhuma decisão atual exige ADR, pois a entrada por arquivos permanece simples e substituível.

## Testing Decisions

- Os testes devem validar comportamento externo observável, nunca seletores internos, estrutura incidental de CSS ou detalhes de implementação.
- O seam principal e idealmente único será o painel carregado no navegador. Nesse nível, um teste pode validar navegação, conteúdo, estados ilustrativos e adaptação visual sem acoplar-se às funções internas.
- O fluxo crítico deve confirmar que as seis abas podem ser abertas por clique e teclado, que apenas o painel selecionado fica visível e que o foco acompanha a navegação por setas, Home e End.
- A alteração de qualquer filtro deve manter os dados fixos e exibir uma mensagem acessível informando que o controle é demonstrativo.
- O teste deve confirmar a presença permanente do aviso de dados fictícios e a ausência de qualquer afirmação de dados reais.
- O teste deve verificar os principais contratos de conteúdo: total de usuários separado de novos, baixas e inativos; inatividade separada de inadimplência; pedidos separados por canal; cancelamentos separados; arquivo ou campo ausente diferente de zero.
- A coerência aritmética dos valores demonstrativos deve ser verificada nos totais que derivam de subtotais visíveis.
- A legibilidade deve ser avaliada nos viewports 16:9 e 1366 × 768, verificando ausência de sobreposição, corte de conteúdo essencial e perda de navegação.
- A acessibilidade deve incluir nomes acessíveis, foco visível, contraste suficiente e comportamento com movimento reduzido.
- O repositório ainda não possui suíte automatizada ou exemplo anterior de teste. O primeiro teste automatizado, se adotado, deve ser um fluxo de navegador de ponta a ponta, evitando criar múltiplas camadas de testes para um protótipo estático.
- Evidência observada: Visão geral e Loja e Pedidos foram inspecionadas visualmente em 16:9, e a navegação e as regras responsivas foram auditadas no código.
- Evidência ainda não validada por pixels: o viewport 1366 × 768 precisa de uma captura e inspeção visual quando a execução local for autorizada.

## Out of Scope

- Conexão direta com banco de dados, APIs, serviços analíticos ou outros aplicativos.
- Autenticação, autorização e perfis de acesso.
- Coleta automática no Clarity ou Google Analytics.
- Filtros funcionais e recálculo dinâmico.
- Dados reais da Lyra ou de Empresas Clientes.
- Exportação para Excel, PNG, PowerPoint ou outros formatos.
- Publicação em servidor ou estratégia de produção.
- Indicadores definitivos da equipe de Desenvolvimento.
- Implementação e automação das validações dos contratos dos arquivos reais.
- Implementação da carga manual por Pasta de Dados, que pertence à fase funcional posterior ao MVP visual.

## Further Notes

- O MVP visual já possui um protótipo local que serve como evidência e baseline de comportamento para esta especificação.
- A aprovação desta fase é visual: conteúdo, organização, hierarquia e aparência. Filtros e comparações não precisam recalcular os dados.
- A implementação futura com dados reais deve preservar as distinções do glossário e validar cada Produto Digital da Lyra M2M a partir dos arquivos fornecidos.
- Os dados de telas serão fornecidos pelos arquivos definidos em `docs/data/CONTRATOS_PASTA_DADOS_V1.md`; as limitações de granularidade do Clarity e do Google Analytics permanecem explícitas nos próprios contratos.
- A especificação não cria compromisso com framework, backend ou mecanismo de implantação para a próxima fase. Ela fixa apenas a entrada manual por arquivos locais e proíbe conexão direta com sistemas externos.
