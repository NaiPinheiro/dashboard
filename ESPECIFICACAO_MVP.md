# Especificação do MVP — Dashboard de Indicadores

## 1. Objetivo

Criar um protótipo visual de dashboard para apoiar apresentações quinzenais e mensais dos indicadores de produto. O MVP deve substituir a troca manual entre telas por uma narrativa única, clara e visualmente consistente.

O MVP serve para aprovar conteúdo, organização e aparência. Ele não representa a solução técnica final.

## 2. Público e uso

- Uso principal: apresentação ao vivo para liderança e áreas interessadas.
- Formato prioritário: tela panorâmica 16:9.
- Adaptação secundária: notebook.
- Abertura padrão: último mês fechado.
- Alternativa visível: seleção de quinzena.
- Comparação: período selecionado contra o período equivalente imediatamente anterior.

## 3. Natureza do MVP

O MVP será um dashboard HTML local com:

- todas as abas navegáveis;
- filtros visíveis, porém apenas ilustrativos;
- números fixos e coerentes entre as telas;
- treze meses de histórico fictício;
- nenhuma conexão direta com banco, API, ferramenta analítica ou outro aplicativo;
- nenhuma exportação de arquivo;
- nenhum dado real da Lyra ou de seus clientes.

A aprovação desta fase considera somente conteúdo, organização e aparência. Cálculos e filtros funcionais serão decididos depois. Na versão funcional, os dados serão fornecidos manualmente por arquivos em uma Pasta de Dados, sem conexão direta com banco ou outro aplicativo.

## 4. Escopo organizacional

### 4.1 Operação Lyra

O painel cobre exclusivamente a **Lyra M2M**. A Lyra Network não faz parte do dashboard.

### 4.2 Produtos digitais

O escopo da Lyra M2M inclui Portal, Loja, Aplicativo e pedidos.

## 5. Estrutura de navegação

O protótipo terá seis abas:

1. **Visão geral**
2. **Usuários e Acessos**
3. **Empresas**
4. **Telas**
5. **Loja e Pedidos**
6. **Desenvolvimento**

A aba Desenvolvimento exibirá apenas uma área “Indicadores em definição”, sem métricas inventadas.

## 6. Filtros visuais

O cabeçalho apresentará controles para:

- período: mês ou quinzena;
- Produto Digital: todos os produtos, Portal, Loja ou Aplicativo.

Nesta fase, os controles demonstram a experiência pretendida, mas não recalculam os números.

## 7. Visão geral

A abertura apresentará um resumo equilibrado de:

- total de usuários;
- novos usuários;
- baixas de usuários;
- usuários inativos;
- total de acessos;
- Empresas Clientes ativas e inativas;
- empresas suspensas por inadimplência;
- pedidos do cliente e pedidos comerciais;
- tendência histórica dos principais indicadores.

Sempre que aplicável, a comparação mostrará lado a lado:

- diferença absoluta;
- variação percentual.

## 8. Regras dos indicadores

### 8.1 Usuários

- **Total de usuários:** contas existentes no fim do período.
- **Novo usuário:** conta criada dentro do período, mesmo sem acesso.
- **Baixa de usuário:** conta desativada ou excluída dentro do período.
- **Usuário inativo:** conta cadastrada sem qualquer acesso nos 30 dias anteriores à data de referência.

Os quatro valores devem aparecer separadamente.

### 8.2 Acessos

- Acesso significa login concluído com sucesso.
- Mostrar total de logins e usuários únicos lado a lado.
- Empresas que mais acessaram devem ser ordenadas por total de logins.
- O ranking também deve exibir os usuários únicos de cada empresa.

### 8.3 Empresas Clientes

- Empresa Cliente pertence à Lyra M2M.
- **Empresa Cliente ativa:** possui status operacional `Production`, `Test`, `activated` ou `active`; `Test` também entra como ativa.
- **Empresa inativa:** possui status operacional `cancelled` ou `inactive`, normalizando variações de maiúsculas e minúsculas.
- **Empresa suspensa por inadimplência:** possui `suspended_defaulter`; para o indicador de suspensões recentes, deve ter recebido esse status dentro da janela móvel dos últimos 30 dias.
- Registros com `wait_aprovement` ficam fora dos indicadores de empresas ativas, inativas e suspensas.
- Suspensões por inadimplência aparecem em cartão próprio e não obedecem ao filtro principal de período.
- Exibir também o ranking de empresas com mais usuários criados no período.

### 8.4 Telas

- Tela acessada é medida por quantidade total de visualizações.
- Não mostrar usuários únicos por tela.
- A limitação existe porque as fontes previstas para essa informação fornecem apenas volumes agregados no contexto disponível.
- Separar visualmente Portal e Aplicativo.

### 8.5 Loja

Mostrar:

- total de logins na Loja;
- usuários únicos que acessaram a Loja;
- Empresas Clientes que acessaram a Loja;
- relação visual entre acesso à Loja e pedidos originados pelo cliente.

A Loja faz parte da Lyra M2M.

### 8.6 Pedidos

- **Pedido do Cliente:** criado por usuário de uma Empresa Cliente.
- **Pedido Comercial:** criado por usuário interno da Lyra.
- Mostrar pedidos criados por canal.
- Mostrar cancelamentos separadamente.
- Pedidos fazem parte da Lyra M2M.

### 8.7 Franquias de dados

- Franquia é o limite de dados móveis associado ao chip, como 10 MB, 100 MB ou 1 GB.
- **Franquia mais comprada:** ranking pela quantidade de chips em pedidos não cancelados.
- **Franquia mais cancelada:** ranking pela quantidade de chips de pedidos cancelados no período.
- Para cancelamentos, usar a data do cancelamento, não a data original do pedido.

## 9. Dados fictícios

O conjunto de demonstração deve:

- cobrir treze meses;
- permitir tendências mensais e uma visualização quinzenal ilustrativa;
- usar nomes realistas, porém integralmente inventados;
- evitar nomes que possam ser confundidos com clientes reais;
- manter consistência matemática entre cartões, rankings e gráficos;
- exibir aviso permanente de que todos os dados são fictícios.

## 10. Direção visual

- Estilo corporativo claro.
- Azul escuro como cor estrutural.
- Cartões claros e poucos destaques cromáticos.
- Hierarquia adequada para leitura à distância.
- Comparações positivas e negativas com cor, ícone e texto — nunca apenas cor.
- Densidade suficiente para apresentar indicadores sem parecer uma planilha.

## 11. Critérios de aprovação do protótipo

O MVP estará pronto para avaliação quando:

1. as seis abas puderem ser abertas;
2. todos os indicadores definidos estiverem representados visualmente;
3. os filtros visuais estiverem presentes e compreensíveis;
4. os dados fictícios forem coerentes entre cartões, rankings e gráficos;
5. o layout funcionar em apresentação 16:9 e continuar legível em notebook;
6. a área de Desenvolvimento estiver identificada como pendente de definição;
7. não houver dados reais, integrações ou exportações;
8. o aviso “dados fictícios” estiver sempre visível.

A aprovação desta fase é visual. Não é necessário que filtros e comparações recalculem os dados.

## 12. Fora do escopo desta fase

- conexão direta com banco de dados;
- APIs ou conexão direta com outros aplicativos;
- autenticação;
- coleta automática no Clarity ou Google Analytics;
- filtros funcionais;
- recálculo dinâmico dos gráficos;
- Excel, PNG ou PowerPoint;
- indicadores definitivos da equipe de desenvolvimento;
- publicação em servidor;
- uso de dados reais.

## 13. Decisões posteriores à aprovação

Após a aprovação visual, serão decididos separadamente:

- indicadores da equipe de desenvolvimento;
- evolução versionada dos contratos dos arquivos quando novas fontes forem validadas;
- localização da Pasta de Dados e processo de Carga Manual de Dados;
- frequência de substituição dos arquivos;
- filtros e cálculos funcionais;
- exportações;
- estratégia de implantação e manutenção.

## 14. Entrada de dados da versão funcional

A versão funcional deverá:

- ler dados exclusivamente de arquivos colocados manualmente pela usuária em uma Pasta de Dados local;
- não se conectar diretamente a banco de dados, API, Clarity, Google Analytics ou outro aplicativo;
- validar os arquivos antes de atualizar os indicadores e informar arquivos ausentes, incompatíveis ou inválidos;
- preservar a última carga válida caso uma nova carga falhe;
- seguir a versão 1.0 dos formatos, nomes, colunas, chaves e validações definida em `docs/data/CONTRATOS_PASTA_DADOS_V1.md`.

A Pasta de Dados não deve ser versionada no GitHub enquanto contiver dados reais.
