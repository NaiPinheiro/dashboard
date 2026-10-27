# Dashboard de Indicadores

Vocabulário compartilhado para o painel usado nas apresentações periódicas dos indicadores de produto e da equipe de desenvolvimento.

## Language

**Painel de Indicadores**:
Superfície visual navegável que consolida indicadores para apresentação ao vivo. Nesta fase, ele é o próprio meio de apresentação, sem gerar arquivos derivados.
_Avoid_: Relatório, apresentação de slides

**Período de Análise**:
Intervalo selecionado para calcular os indicadores: uma quinzena ou um mês. Cada período é comparado ao intervalo equivalente imediatamente anterior.
_Avoid_: Data da apresentação, período atual

**Visão Consolidada**:
Leitura agregada dos indicadores de todas as empresas e produtos incluídos na seleção. Ela complementa, sem substituir, as leituras filtradas por empresa ou produto.
_Avoid_: Total geral sem filtros

**MVP do Painel**:
Protótipo visual com dados fictícios e abas navegáveis, usado para validar conteúdo, organização e aparência antes do desenvolvimento. Seus filtros são apenas visuais e os números permanecem fixos.
_Avoid_: Versão funcional, integração real

**Pasta de Dados**:
Diretório local no qual a usuária disponibiliza manualmente os arquivos usados pelo Painel de Indicadores. É a fronteira de entrada prevista para a versão funcional; o painel não se conecta diretamente a banco de dados, API ou outro aplicativo.
_Avoid_: Banco do painel, integração automática

**Carga Manual de Dados**:
Ato de colocar ou substituir arquivos na Pasta de Dados para uma atualização do painel. A versão 1.0 dos formatos, nomes e estruturas aceitos está definida em `docs/data/CONTRATOS_PASTA_DADOS_V1.md`.
_Avoid_: Sincronização automática, conexão direta


**Novo Usuário**:
Conta de usuário criada dentro do período de análise, independentemente de ter realizado acesso.
_Avoid_: Usuário ativo, primeiro acesso

**Baixa de Usuário**:
Conta de usuário desativada ou excluída dentro do período de análise.
_Avoid_: Usuário inativo, usuário sem acesso

**Usuário Inativo**:
Conta ainda cadastrada que não realizou nenhum acesso nos 30 dias anteriores à data de referência.
_Avoid_: Baixa, usuário excluído

**Acesso**:
Login concluído com sucesso em um produto. O painel apresenta tanto o total de logins quanto a quantidade de usuários únicos que acessaram.
_Avoid_: Visualização de tela, tentativa de login

**Operação Lyra**:
Contexto empresarial dos indicadores deste painel: Lyra M2M. A Lyra Network não faz parte do escopo.
_Avoid_: Empresa Cliente, Lyra Network

**Produto Digital**:
Ambiente utilizado pelos usuários: Portal, Loja ou Aplicativo, conforme a disponibilidade em cada Operação Lyra.
_Avoid_: Franquia, plano de chip

**Área de Desenvolvimento**:
Espaço reservado no MVP para os futuros indicadores da equipe de desenvolvimento. Seu conteúdo será definido depois da validação dos indicadores de produto.
_Avoid_: Indicadores já aprovados


**Empresa Cliente**:
Organização cliente vinculada à Lyra M2M e que utiliza um ou mais Produtos Digitais.
_Avoid_: Operação Lyra, produto

**Empresa Cliente Ativa**:
Empresa Cliente cujo status operacional seja `Production`, `Test`, `activated` ou `active`. O status `Test` não exclui a organização do universo de Empresas Clientes ativas.
_Avoid_: Empresa suspensa por inadimplência, empresa aguardando aprovação

**Empresa Suspensa por Inadimplência**:
Empresa Cliente com status operacional `suspended_defaulter`. Para o indicador de suspensões recentes, a empresa deve ter recebido esse status dentro da janela móvel dos últimos 30 dias, independentemente do Período de Análise selecionado.
_Avoid_: Empresa inativa, empresa sem acesso

**Empresa Inativa**:
Empresa Cliente cujo status operacional seja `cancelled` ou `inactive`, normalizando variações de maiúsculas e minúsculas como `Canceled`. Empresas com `suspended_defaulter` permanecem na categoria própria de suspensão. Registros com `wait_aprovement` ficam fora dos indicadores de empresas ativas, inativas e suspensas.
_Avoid_: Empresa suspensa por inadimplência, empresa sem acesso

**Franquia de Dados**:
Limite de dados móveis associado a cada chip, expresso em unidades como MB ou GB.
_Avoid_: Produto Digital, pacote do pedido

**Franquia Comprada**:
Franquia de Dados contabilizada pela quantidade de chips presente em pedidos não cancelados. O ranking é ordenado pela quantidade de chips, não pelo número de pedidos.
_Avoid_: Franquia solicitada, pedido por franquia

**Franquia Cancelada**:
Franquia de Dados contabilizada pela quantidade de chips de pedidos cancelados no Período de Análise, usando a data do cancelamento.
_Avoid_: Franquia comprada, cancelamento pela data do pedido

**Visualização de Tela**:
Cada abertura registrada de uma tela do Portal ou do Aplicativo. O indicador contabiliza apenas o volume total de visualizações, sem atribuí-las a usuários únicos.
_Avoid_: Login, usuário único

**Acesso à Loja**:
Login realizado na Loja. O painel apresenta o total de logins, os usuários únicos e as Empresas Clientes que acessaram.
_Avoid_: Pedido, visualização de tela

**Pedido do Cliente**:
Pedido criado por um usuário de uma Empresa Cliente.
_Avoid_: Pedido comercial

**Pedido Comercial**:
Pedido criado por um usuário interno da Lyra em nome de uma Empresa Cliente.
_Avoid_: Pedido do cliente

**Pedido Criado**:
Pedido registrado dentro do período de análise, classificado como Pedido do Cliente ou Pedido Comercial.
_Avoid_: Pedido concluído, cancelamento

**Cancelamento de Pedido**:
Cancelamento registrado separadamente dos pedidos criados, para que o painel não misture entrada de pedidos com perdas posteriores.
_Avoid_: Pedido criado
