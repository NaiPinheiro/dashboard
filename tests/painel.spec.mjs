import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const testDataPath = resolve('tests/.data');
const testCachePath = resolve('tests/.cache');
const validLoadPath = resolve('tests/fixtures/carga-usuarios-valida');

async function stageValidUserLoad() {
  await Promise.all([
    rm(testDataPath, { force: true, recursive: true }),
    rm(testCachePath, { force: true, recursive: true }),
  ]);
  await mkdir(testDataPath, { recursive: true });
  await cp(validLoadPath, testDataPath, { recursive: true });
}

test.beforeEach(stageValidUserLoad);

const areas = [
  ['Visão geral', 'Visão geral de setembro de 2026'],
  ['Usuários e Acessos', 'Usuários e Acessos'],
  ['Empresas', 'Empresas Clientes'],
  ['Telas', 'Telas mais acessadas'],
  ['Loja e Pedidos', 'Loja e Pedidos'],
  ['Desenvolvimento', 'Indicadores de Desenvolvimento'],
];

test('a gerente percorre as seis áreas do MVP do Painel', async ({ page }) => {
  await page.goto('/painel.html');

  await expect(page).toHaveTitle(/Painel de Indicadores/);
  await expect(
    page.getByText('Dados mistos · 5 fontes disponíveis; lacunas sinalizadas'),
  ).toBeVisible();

  const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await expect(navigation.getByRole('tab')).toHaveCount(6);

  for (const [tabName, headingName] of areas) {
    const tab = navigation.getByRole('tab', { name: tabName, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: headingName, exact: true })).toBeVisible();
  }

  const development = navigation.getByRole('tab', {
    name: 'Desenvolvimento',
    exact: true,
  });
  await development.press('Home');

  const overview = navigation.getByRole('tab', {
    name: 'Visão geral',
    exact: true,
  });
  const users = navigation.getByRole('tab', {
    name: 'Usuários e Acessos',
    exact: true,
  });
  await expect(overview).toBeFocused();
  await expect(overview).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('heading', { name: 'Visão geral de setembro de 2026', exact: true }),
  ).toBeVisible();

  await overview.press('ArrowRight');
  await expect(users).toBeFocused();
  await expect(users).toHaveAttribute('aria-selected', 'true');

  await users.press('ArrowLeft');
  await expect(overview).toBeFocused();
  await expect(overview).toHaveAttribute('aria-selected', 'true');

  await overview.press('End');
  await expect(development).toBeFocused();
  await expect(development).toHaveAttribute('aria-selected', 'true');
});


test('a gerente vê os indicadores de Usuários vindos de uma carga válida', async ({ page }) => {
  await page.goto('/painel.html');

  const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Usuários e Acessos', exact: true }).click();

  const usersPanel = page.getByRole('tabpanel', { name: 'Usuários e Acessos' });
  await expect(usersPanel.getByText('410', { exact: true })).toBeVisible();
  await expect(usersPanel.getByText('44', { exact: true })).toBeVisible();
  await expect(usersPanel.getByText('64', { exact: true })).toBeVisible();
  await expect(usersPanel.getByText('Indisponível', { exact: true })).toBeVisible();
  const usersSource = usersPanel.getByRole('article', { name: 'Estado dos arquivos de Usuários' });
  await expect(usersSource.getByText('Origem: MySQL · Estado: pronto', { exact: true })).toHaveCount(2);
  await expect(usersSource.getByText('Abrangência: 01/08/2026 a 30/09/2026', { exact: true })).toBeVisible();

  await navigation.getByRole('tab', { name: 'Empresas', exact: true }).click();
  const companiesPanel = page.getByRole('tabpanel', { name: 'Empresas' });
  await expect(companiesPanel.getByText('EMP-001', { exact: true })).toBeVisible();
  await expect(companiesPanel.locator('#users-ranking').getByText('12', { exact: true })).toBeVisible();

  const privateFileResponse = await page.request.get('/tests/fixtures/carga-usuarios-valida/usuarios.csv');
  expect(privateFileResponse.status()).toBe(404);
  const missingPublicAsset = await page.request.get('/assets/missing.css');
  expect(missingPublicAsset.status()).toBe(404);
});


test('uma tentativa inválida preserva a última carga válida de Usuários', async ({ page }) => {
  await page.goto('/painel.html');
  await expect(page.getByText('Dados mistos · 5 fontes disponíveis; lacunas sinalizadas')).toBeVisible();

  await writeFile(
    resolve(testDataPath, 'usuarios.csv'),
    'tipo_registro;mes;empresa_id_opaco;total_usuarios;ativos_por_status;inativos_por_status;inativados_por_inadimplencia;novos_usuarios;posicao;email\n' +
      'snapshot_status_atual;2026-09;;999;999;0;0;;;pessoa@example.com\n',
    'utf8',
  );

  await page.reload();

  const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Usuários e Acessos', exact: true }).click();
  await expect(page.getByText('Última carga válida preservada')).toBeVisible();
  const usersPanel = page.getByRole('tabpanel', { name: 'Usuários e Acessos' });
  await expect(usersPanel.getByText('410', { exact: true })).toBeVisible();
  await expect(usersPanel.getByText('999', { exact: true })).toHaveCount(0);
  await expect(usersPanel.getByText('pessoa@example.com', { exact: true })).toHaveCount(0);
});


test('sem cache anterior, somente o conjunto inválido aparece como Indisponível', async ({ page }) => {
  await writeFile(
    resolve(testDataPath, 'usuarios.csv'),
    'tipo_registro;mes;empresa_id_opaco;total_usuarios;ativos_por_status;inativos_por_status;inativados_por_inadimplencia;novos_usuarios;posicao\n' +
      'snapshot_status_atual;2026-13;;410;330;70;10;;\n',
    'utf8',
  );
  await page.goto('/painel.html');
  let navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Usuários e Acessos', exact: true }).click();
  let usersPanel = page.getByRole('tabpanel', { name: 'Usuários e Acessos' });
  let totalCard = usersPanel.locator('article').filter({ hasText: 'Total existente' });
  let inactivityCard = usersPanel.locator('article').filter({ hasText: 'Inativos · 30 dias' });
  await expect(totalCard.getByText('Indisponível', { exact: true })).toBeVisible();
  await expect(inactivityCard.getByText('64', { exact: true })).toBeVisible();
  await expect(totalCard.getByText('410', { exact: true })).toHaveCount(0);

  await stageValidUserLoad();
  await writeFile(
    resolve(testDataPath, 'usuarios_inatividade.csv'),
    'data_referencia;usuarios_sem_login_30_dias;usuarios_ativos_no_cadastro_sem_login_30_dias;usuarios_nao_ativos_no_cadastro_sem_login_30_dias\n' +
      '2026-09-31;64;50;14\n',
    'utf8',
  );
  await page.reload();
  navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Usuários e Acessos', exact: true }).click();
  usersPanel = page.getByRole('tabpanel', { name: 'Usuários e Acessos' });
  totalCard = usersPanel.locator('article').filter({ hasText: 'Total existente' });
  inactivityCard = usersPanel.locator('article').filter({ hasText: 'Inativos · 30 dias' });
  await expect(totalCard.getByText('410', { exact: true })).toBeVisible();
  await expect(inactivityCard.getByText('Indisponível', { exact: true })).toBeVisible();
  await expect(inactivityCard.getByText('64', { exact: true })).toHaveCount(0);
});


test('o contrato rejeita duplicidade, total negativo, PII e período inválido sem perder a carga ativa', async ({ page }) => {
  await page.goto('/painel.html');
  await expect(page.getByText('Dados mistos · 5 fontes disponíveis; lacunas sinalizadas')).toBeVisible();

  const invalidAttempts = [
    {
      file: 'usuarios.csv',
      content:
        'tipo_registro;mes;empresa_id_opaco;total_usuarios;ativos_por_status;inativos_por_status;inativados_por_inadimplencia;novos_usuarios;posicao\n' +
        'snapshot_status_atual;2026-09;;410;330;70;10;;\n' +
        'novos_usuarios_mes;2026-09;;;;;;44;\n' +
        'novos_usuarios_mes;2026-09;;;;;;45;\n',
    },
    {
      file: 'usuarios.csv',
      content:
        'tipo_registro;mes;empresa_id_opaco;total_usuarios;ativos_por_status;inativos_por_status;inativados_por_inadimplencia;novos_usuarios;posicao\n' +
        'snapshot_status_atual;2026-09;;-1;0;0;0;;\n',
    },
    {
      file: 'usuarios.csv',
      content:
        'tipo_registro;mes;empresa_id_opaco;total_usuarios;ativos_por_status;inativos_por_status;inativados_por_inadimplencia;novos_usuarios;posicao\n' +
        'snapshot_status_atual;2026-09;;410;330;70;10;;\n' +
        'ranking_novos_usuarios_empresa;2026-09;pessoa@example.com;;;;;12;1\n',
    },
    {
      file: 'usuarios.csv',
      content:
        'tipo_registro;mes;empresa_id_opaco;total_usuarios;ativos_por_status;inativos_por_status;inativados_por_inadimplencia;novos_usuarios;posicao\n' +
        'snapshot_status_atual;2026-09;;410;330;70;10;;\n' +
        'ranking_novos_usuarios_empresa;2026-09;+55 (11) 99999-9999;;;;;12;1\n',
    },
    {
      file: 'manifesto_carga.csv',
      content:
        'versao_contrato;arquivo;gerado_em;periodo_inicio;periodo_fim;periodo_parcial;fonte_origem;estado_fonte;observacao\n' +
        '1.0;usuarios.csv;2026-09-30T23:59:00-03:00;2026-07-01;2026-07-31;false;mysql;pronto;Carga fictícia de teste\n' +
        '1.0;usuarios_inatividade.csv;2026-09-30T23:59:00-03:00;2026-09-01;2026-09-30;false;mysql;pronto;Fotografia fictícia de teste\n',
    },
    {
      file: 'manifesto_carga.csv',
      content:
        'versao_contrato;arquivo;gerado_em;periodo_inicio;periodo_fim;periodo_parcial;fonte_origem;estado_fonte;observacao\n' +
        '1.0;usuarios.csv;2026-09-30T23:59:00-03:00;2026-09-31;2026-09-30;false;mysql;pronto;Carga fictícia de teste\n' +
        '1.0;usuarios_inatividade.csv;2026-09-30T23:59:00-03:00;2026-09-01;2026-09-30;false;mysql;pronto;Fotografia fictícia de teste\n',
    },
  ];

  for (const attempt of invalidAttempts) {
    await cp(validLoadPath, testDataPath, { force: true, recursive: true });
    await writeFile(resolve(testDataPath, attempt.file), attempt.content, 'utf8');
    await page.reload();
    const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
    await navigation.getByRole('tab', { name: 'Usuários e Acessos', exact: true }).click();
    const usersPanel = page.getByRole('tabpanel', { name: 'Usuários e Acessos' });
    const totalCard = usersPanel.locator('article').filter({ hasText: 'Total existente' });
    await expect(usersPanel.locator('#users-source-state')).toHaveText('Última carga válida preservada');
    await expect(totalCard.getByText('410', { exact: true })).toBeVisible();
  }
});


test('sem JavaScript, indicadores funcionais não exibem valores fictícios', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8792/painel.html');
  const overview = page.getByRole('tabpanel', { name: 'Visão geral' });
  await expect(overview.getByText('Indisponível', { exact: true }).first()).toBeVisible();
  await expect(overview.getByText('396', { exact: true })).toHaveCount(0);
  await expect(overview.getByText('42', { exact: true })).toHaveCount(0);
  await expect(overview.getByText('58', { exact: true })).toHaveCount(0);
  await context.close();
});

test('um backup íntegro recupera a última carga quando a troca do cache é interrompida', async ({ page }) => {
  await page.goto('/painel.html');
  await expect(page.getByText('Dados mistos · 5 fontes disponíveis; lacunas sinalizadas')).toBeVisible();

  const userCache = resolve(testCachePath, 'usuarios.json');
  const userBackup = resolve(testCachePath, 'usuarios.json.bak');
  await rename(userCache, userBackup);
  await writeFile(userCache, '{cache interrompido', 'utf8');
  await writeFile(
    resolve(testDataPath, 'usuarios.csv'),
    'tipo_registro;mes;empresa_id_opaco;total_usuarios;ativos_por_status;inativos_por_status;inativados_por_inadimplencia;novos_usuarios;posicao;campo_extra\n',
    'utf8',
  );

  await page.reload();
  const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Usuários e Acessos', exact: true }).click();
  const usersPanel = page.getByRole('tabpanel', { name: 'Usuários e Acessos' });
  const totalCard = usersPanel.locator('article').filter({ hasText: 'Total existente' });
  await expect(usersPanel.getByText('Última carga válida preservada')).toBeVisible();
  await expect(totalCard.getByText('410', { exact: true })).toBeVisible();
});


test('o Portal mostra somente o total derivado e mantém visualizações por tela não validadas', async ({ page }) => {
  await page.goto('/painel.html');
  const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Telas', exact: true }).click();

  const screensPanel = page.getByRole('tabpanel', { name: 'Telas' });
  const portalCard = screensPanel.locator('article').filter({ hasText: 'Portal · Lyra M2M' });
  await expect(portalCard.getByText('12.480', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('Estimativa derivada', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('Visualizações por tela: Não validado', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('Ausência no ranking não representa zero', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('O export geral preserva somente as 12 URLs principais', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('Rotas fora do ranking permanecem sem cobertura validada', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('Origem: Microsoft Clarity · Estado: parcial', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('Abrangência: 01/08/2026 a 30/09/2026', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('Período parcial', { exact: true })).toBeVisible();

  await expect(screensPanel.getByText('720', { exact: true })).toHaveCount(0);
  await expect(screensPanel.getByText('77', { exact: true })).toHaveCount(0);
  await expect(screensPanel.getByText('900', { exact: true })).toHaveCount(0);
  await expect(screensPanel.getByText('1.300', { exact: true })).toHaveCount(0);
  await expect(screensPanel.getByText('50.000', { exact: true })).toHaveCount(0);
  await expect(screensPanel.getByText('Dashboard', { exact: true })).toHaveCount(0);
});

test('um telas_portal.csv inválido preserva o cache válido sem expor conteúdo rejeitado', async ({ page }) => {
  await page.goto('/painel.html');
  await writeFile(
    resolve(testDataPath, 'telas_portal.csv'),
    'periodo;produto;fonte;escopo;metrica;tela_ou_funcao;valor;unidade;evidencia;observacao;email\n' +
      '2026-08-01 a 2026-09-30;Portal M2M;Microsoft Clarity;producao;visualizacoes_de_pagina_total;segredo@example.com;99999;visualizacoes;derivado;Inválido;segredo@example.com\n',
    'utf8',
  );

  const rejectionResponse = await page.request.get('/api/telas-portal');
  const rejectionPayload = await rejectionResponse.json();
  expect(rejectionPayload.rejection).toMatchObject({ file: 'telas_portal.csv' });
  expect(rejectionPayload.rejection.attemptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(rejectionPayload.rejection.reasons).toEqual([
    'telas_portal.csv: cabeçalho incompatível ou com colunas extras.',
  ]);
  expect(JSON.stringify(rejectionPayload.rejection)).not.toContain('segredo@example.com');

  await page.reload();
  const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Telas', exact: true }).click();
  const portalCard = page.getByRole('tabpanel', { name: 'Telas' }).locator('article').filter({ hasText: 'Portal · Lyra M2M' });
  await expect(portalCard.getByText('Última carga válida preservada', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('12.480', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('99.999', { exact: true })).toHaveCount(0);
  await expect(page.getByText('segredo@example.com', { exact: false })).toHaveCount(0);
});

test('telas_portal.csv ausente preserva o cache e avisa que a fonte não foi atualizada', async ({ page }) => {
  await page.goto('/painel.html');
  await rm(resolve(testDataPath, 'telas_portal.csv'));

  await page.reload();
  const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Telas', exact: true }).click();
  const portalCard = page.getByRole('tabpanel', { name: 'Telas' }).locator('article').filter({ hasText: 'Portal · Lyra M2M' });
  await expect(portalCard.getByText('Fonte não atualizada', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('12.480', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('Visualizações por tela: Não validado', { exact: true })).toBeVisible();
});


test('sem cache, telas do Portal inválidas ficam indisponíveis e nunca viram zero', async ({ page }) => {
  await writeFile(
    resolve(testDataPath, 'telas_portal.csv'),
    'periodo;produto;fonte;escopo;metrica;tela_ou_funcao;valor;unidade;evidencia;observacao\n' +
      '2026-08-01 a 2026-09-30;Portal M2M;Microsoft Clarity;producao;visualizacoes_por_tela;Top 12;0;visualizacoes;nao_validado;Ausência não é zero\n',
    'utf8',
  );

  await page.goto('/painel.html');
  const unavailableResponse = await page.request.get('/api/telas-portal');
  const unavailablePayload = await unavailableResponse.json();
  expect(unavailablePayload.status).toBe('unavailable');
  expect(unavailablePayload.indicators.excludedLocalRows).toBeNull();
  expect(unavailablePayload.indicators.excludedSessionOrEventRows).toBeNull();

  const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Telas', exact: true }).click();
  const portalCard = page.getByRole('tabpanel', { name: 'Telas' }).locator('article').filter({ hasText: 'Portal · Lyra M2M' });
  await expect(portalCard.getByText('Indisponível', { exact: true })).toBeVisible();
  await expect(portalCard.getByText('0', { exact: true })).toHaveCount(0);
  await expect(portalCard.getByText('Visualizações por tela: Não validado', { exact: true })).toBeVisible();
});


test('Loja, Pedidos, Franquias e suspensões recentes permanecem sem números inventados', async ({ page }) => {
  await page.goto('/painel.html');

  const overview = page.getByRole('tabpanel', { name: 'Visão geral' });
  await expect(overview.locator('article').filter({ hasText: 'Pedidos criados' }).getByText('Indisponível', { exact: true })).toBeVisible();
  await expect(overview.locator('article').filter({ hasText: 'Suspensas' }).getByText('Indisponível', { exact: true })).toBeVisible();
  await expect(overview.getByText('184', { exact: true })).toHaveCount(0);
  await expect(overview.getByText('5', { exact: true })).toHaveCount(0);

  const dashboard = page.locator('main');
  await expect(dashboard.getByText('1.428', { exact: true })).toHaveCount(0);
  await expect(dashboard.getByText('184 pedidos no período', { exact: true })).toHaveCount(0);
  await expect(dashboard.getByText('2.740 chips', { exact: true })).toHaveCount(0);
  await expect(dashboard.getByText('Os logins da Loja aparecem na aba Loja e Pedidos.', { exact: true })).toHaveCount(0);

  const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Loja e Pedidos', exact: true }).click();
  const storePanel = page.getByRole('tabpanel', { name: 'Loja e Pedidos' });
  await expect(storePanel.locator('.not-available').filter({ hasText: 'Dados futuros' })).toHaveCount(3);
});

test('os metadados do Portal não sobrepõem o cartão do Aplicativo em 1024x768', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/painel.html');
  await page.getByRole('tablist', { name: 'Áreas do painel' })
    .getByRole('tab', { name: 'Telas', exact: true })
    .click();

  const portalCard = page.locator('#portal-screens-card');
  const applicationCard = page.getByRole('tabpanel', { name: 'Telas' })
    .locator('article')
    .filter({ hasText: 'Aplicativo · Lyra M2M' });
  const layout = await page.evaluate(() => {
    const portal = document.querySelector('#portal-screens-card').getBoundingClientRect();
    const application = [...document.querySelectorAll('#screens article')]
      .find((element) => element.textContent.includes('Aplicativo · Lyra M2M'))
      .getBoundingClientRect();
    const metadataChildren = [...document.querySelectorAll('#portal-screens-card .source-file-row > *')]
      .map((element) => element.getBoundingClientRect());
    return {
      cardsStacked: application.top >= portal.bottom - 1,
      metadataInsidePortal: metadataChildren.every((item) => item.right <= portal.right + 1),
    };
  });

  await expect(portalCard).toBeVisible();
  await expect(applicationCard).toBeVisible();
  expect(layout.cardsStacked || layout.metadataInsidePortal).toBe(true);
});



test('Issue #5 classifica empresas por si_status, mantém status para auditoria e mostra metadados', async ({ page }) => {
  await page.goto('/painel.html');

  const response = await page.request.get('/api/empresas');
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload).toMatchObject({
    status: 'ready',
    indicators: {
      active: 24,
      inactive: 8,
      suspendedCurrent: 7,
      suspendedLast30Days: null,
      excludedWaitApproval: 9,
      unclassifiedTotal: 11,
    },
  });
  expect(payload.indicators.statusAudit).toContainEqual({
    status: 'Operacional',
    siStatus: 'Production',
    category: 'active',
    quantity: 12,
  });

  const navigation = page.getByRole('tablist', { name: 'Áreas do painel' });
  await navigation.getByRole('tab', { name: 'Empresas', exact: true }).click();
  const companiesPanel = page.getByRole('tabpanel', { name: 'Empresas' });
  await expect(companiesPanel.locator('[data-company-value="active"]')).toHaveText('24');
  await expect(companiesPanel.locator('[data-company-value="inactive"]')).toHaveText('8');
  await expect(companiesPanel.locator('[data-company-value="suspended-current"]')).toHaveText('7');
  await expect(companiesPanel.locator('[data-company-value="suspended-30-days"]')).toHaveText('Indisponível');
  await expect(companiesPanel.getByText('Status não classificado: novo_status · 11 fora dos totais', { exact: true })).toBeVisible();
  await expect(companiesPanel.getByText('wait_aprovement · 9 fora dos indicadores', { exact: true })).toBeVisible();
  await expect(companiesPanel.getByText('Operacional', { exact: true }).first()).toBeVisible();
  await expect(companiesPanel.getByText('Production', { exact: true })).toBeVisible();
  await expect(companiesPanel.getByRole('article', { name: 'Estado do arquivo de Empresas Clientes' })
    .getByText('Origem: MySQL · Estado: pronto', { exact: true })).toBeVisible();
  await expect(companiesPanel.getByText('Referência: 30/09/2026', { exact: true })).toBeVisible();
  await expect(companiesPanel.getByText('Gerado em:', { exact: false })).toBeVisible();
  await expect(companiesPanel.getByText('empresas.csv é uma fotografia atual e não informa quando ocorreu cada suspensão.', { exact: true })).toBeVisible();
});


test('Issue #5 preserva o cache válido quando empresas.csv é rejeitado sem expor linhas', async ({ page }) => {
  await page.goto('/painel.html');
  await writeFile(
    resolve(testDataPath, 'empresas.csv'),
    'status;si_status;quantidade;email\n' +
      'Operacional;Production;999;segredo@example.com\n',
    'utf8',
  );

  const response = await page.request.get('/api/empresas');
  const payload = await response.json();
  expect(payload.status).toBe('stale');
  expect(payload.indicators.active).toBe(24);
  expect(payload.rejection).toMatchObject({ file: 'empresas.csv' });
  expect(payload.rejection.attemptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(payload.rejection.reasons).toEqual([
    'empresas.csv: cabeçalho incompatível ou com colunas extras.',
  ]);
  expect(JSON.stringify(payload.rejection)).not.toContain('segredo@example.com');

  await page.reload();
  await page.getByRole('tablist', { name: 'Áreas do painel' })
    .getByRole('tab', { name: 'Empresas', exact: true })
    .click();
  const companiesPanel = page.getByRole('tabpanel', { name: 'Empresas' });
  await expect(companiesPanel.locator('#companies-source-state')).toHaveText('Última carga válida preservada');
  await expect(companiesPanel.locator('[data-company-value="active"]')).toHaveText('24');
  await expect(companiesPanel.getByText('999', { exact: true })).toHaveCount(0);
  await expect(companiesPanel.getByText('segredo@example.com', { exact: false })).toHaveCount(0);
});


test('Issue #5 avisa quando empresas.csv está ausente e preserva a última versão válida', async ({ page }) => {
  await page.goto('/painel.html');
  await rm(resolve(testDataPath, 'empresas.csv'));

  await page.reload();
  await page.getByRole('tablist', { name: 'Áreas do painel' })
    .getByRole('tab', { name: 'Empresas', exact: true })
    .click();
  const companiesPanel = page.getByRole('tabpanel', { name: 'Empresas' });
  await expect(companiesPanel.getByText('Fonte não atualizada', { exact: true })).toBeVisible();
  await expect(companiesPanel.locator('[data-company-value="active"]')).toHaveText('24');
  await expect(companiesPanel.locator('[data-company-value="suspended-30-days"]')).toHaveText('Indisponível');
});


test('Issue #5 sem cache deixa empresas inválidas indisponíveis e nunca converte ausência em zero', async ({ page }) => {
  await writeFile(
    resolve(testDataPath, 'empresas.csv'),
    'status;si_status;quantidade\n' +
      'Operacional;Production;-1\n',
    'utf8',
  );

  await page.goto('/painel.html');
  const response = await page.request.get('/api/empresas');
  const payload = await response.json();
  expect(payload.status).toBe('unavailable');
  expect(payload.indicators.active).toBeNull();
  expect(payload.indicators.inactive).toBeNull();
  expect(payload.indicators.suspendedCurrent).toBeNull();
  expect(payload.indicators.suspendedLast30Days).toBeNull();

  await page.getByRole('tablist', { name: 'Áreas do painel' })
    .getByRole('tab', { name: 'Empresas', exact: true })
    .click();
  const companiesPanel = page.getByRole('tabpanel', { name: 'Empresas' });
  await expect(companiesPanel.locator('[data-company-value="active"]')).toHaveText('Indisponível');
  await expect(companiesPanel.locator('[data-company-value="inactive"]')).toHaveText('Indisponível');
  await expect(companiesPanel.locator('[data-company-value="suspended-current"]')).toHaveText('Indisponível');
  await expect(companiesPanel.getByText('0', { exact: true })).toHaveCount(0);
});


test.describe('Issue #6 · Acessos e ranking', () => {
  test('carrega combinações válidas e oferece somente filtros sustentados pelos dados', async ({ page }) => {
    await page.goto('/painel.html');

    const response = await page.request.get('/api/acessos');
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      status: 'ready',
      indicators: {
        combinations: [
          { month: '2026-08', product: 'Portal Web', totalLogins: 900, uniqueUsers: 150, distinctCompanies: 12, coverage: 'ready' },
          { month: '2026-08', product: 'Aplicativo', totalLogins: 320, uniqueUsers: 86, distinctCompanies: 9, coverage: 'partial' },
          { month: '2026-09', product: 'Portal Web', totalLogins: 1200, uniqueUsers: 180, distinctCompanies: 14, coverage: 'ready' },
          { month: '2026-09', product: 'Loja Web', totalLogins: 240, uniqueUsers: 75, distinctCompanies: 8, coverage: 'ready' },
          { month: '2026-09', product: 'Aplicativo', totalLogins: 480, uniqueUsers: 102, distinctCompanies: 10, coverage: 'partial' },
          { month: '2026-09', product: 'Loja Aplicativo', totalLogins: 0, uniqueUsers: 0, distinctCompanies: 0, coverage: 'partial' },
        ],
      },
    });

    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Usuários e Acessos', exact: true })
      .click();
    const usersPanel = page.getByRole('tabpanel', { name: 'Usuários e Acessos' });
    const periodFilter = page.getByLabel('Período analisado');
    const productFilter = page.getByLabel('Produto Digital');

    await expect(periodFilter.locator('option')).toHaveText(['Setembro de 2026', 'Agosto de 2026']);
    await expect(productFilter.locator('option')).toHaveText(['Portal Web', 'Loja Web', 'Aplicativo', 'Loja Aplicativo']);
    await expect(usersPanel.locator('[data-access-value="total-logins"]')).toHaveText('1.200');
    await expect(usersPanel.locator('[data-access-value="unique-users"]')).toHaveText('180');
    await expect(usersPanel.locator('[data-access-value="distinct-companies"]')).toHaveText('14');
    await expect(usersPanel.getByText('Dados prontos', { exact: true })).toBeVisible();

    await productFilter.selectOption('Aplicativo');
    await expect(usersPanel.locator('[data-access-value="total-logins"]')).toHaveText('480');
    await expect(usersPanel.locator('#access-coverage')).toHaveText('Cobertura parcial');

    await periodFilter.selectOption('2026-08');
    await expect(productFilter).toHaveValue('Aplicativo');
    await expect(productFilter.locator('option')).toHaveText(['Portal Web', 'Aplicativo']);
    await expect(usersPanel.locator('[data-access-value="total-logins"]')).toHaveText('320');
    await expect(usersPanel.getByText('Loja Web e Loja Aplicativo: não informado neste período.', { exact: true })).toBeVisible();
  });

  test('ordena o ranking por logins com desempate determinístico e mostra metadados', async ({ page }) => {
    await page.goto('/painel.html');
    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Empresas', exact: true })
      .click();

    const companiesPanel = page.getByRole('tabpanel', { name: 'Empresas' });
    const ranking = companiesPanel.locator('#access-ranking');
    await expect(ranking.locator('tbody tr')).toHaveCount(3);
    await expect(ranking.locator('tbody tr').nth(0)).toContainText('EMP-ALFA');
    await expect(ranking.locator('tbody tr').nth(1)).toContainText('EMP-BETA');
    await expect(ranking.locator('tbody tr').nth(2)).toContainText('EMP-GAMA');
    await expect(ranking.locator('tbody tr').nth(1)).toContainText('300');
    await expect(ranking.locator('tbody tr').nth(1)).toContainText('30');
    await expect(ranking.getByText('Origem: MySQL · Estado: pronto', { exact: true })).toBeVisible();
    await expect(ranking.getByText('Abrangência: 01/08/2026 a 30/09/2026', { exact: true })).toBeVisible();
    await expect(companiesPanel.getByText('Ranking de setembro de 2026 · Portal Web', { exact: true })).toBeVisible();

    await page.getByLabel('Produto Digital').selectOption('Aplicativo');
    await expect(ranking.locator('tbody tr')).toHaveCount(2);
    await expect(companiesPanel.getByText('Ranking com cobertura parcial', { exact: true })).toBeVisible();
  });

  test('preserva caches válidos por arquivo após rejeição e não registra conteúdo das linhas', async ({ page }) => {
    await page.goto('/painel.html');
    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Usuários e Acessos', exact: true })
      .click();
    await expect(page.getByRole('tabpanel', { name: 'Usuários e Acessos' })
      .locator('[data-access-value="total-logins"]')).toHaveText('1.200');
    await writeFile(
      resolve(testDataPath, 'acessos.csv'),
      'mes;produto_digital;total_logins;usuarios_unicos;empresas_clientes_distintas;email\n' +
        '2026-09;Portal Web;999;10;2;segredo@example.com\n',
      'utf8',
    );

    const response = await page.request.get('/api/acessos');
    const payload = await response.json();
    expect(payload.status).toBe('stale');
    expect(payload.indicators.combinations).toContainEqual({
      month: '2026-09', product: 'Portal Web', totalLogins: 1200, uniqueUsers: 180, distinctCompanies: 14, coverage: 'ready',
    });
    expect(payload.rejections).toContainEqual(expect.objectContaining({ file: 'acessos.csv' }));
    expect(JSON.stringify(payload.rejections)).not.toContain('segredo@example.com');
    expect(payload.ranking).toEqual(expect.arrayContaining([
      expect.objectContaining({ month: '2026-09', product: 'Portal Web', companyId: 'EMP-ALFA' }),
    ]));

    await page.reload();
    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Usuários e Acessos', exact: true })
      .click();
    const usersPanel = page.getByRole('tabpanel', { name: 'Usuários e Acessos' });
    await expect(usersPanel.getByText('Última carga válida de acessos preservada', { exact: true })).toBeVisible();
    await expect(usersPanel.locator('[data-access-value="total-logins"]')).toHaveText('1.200');
    await expect(page.getByText('segredo@example.com', { exact: false })).toHaveCount(0);
  });

  test('rejeita usuários únicos acima dos logins e ranking fora de ordem sem perder os caches', async ({ page }) => {
    await page.goto('/painel.html');
    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Usuários e Acessos', exact: true })
      .click();
    await expect(page.getByRole('tabpanel', { name: 'Usuários e Acessos' })
      .locator('[data-access-value="total-logins"]')).toHaveText('1.200');

    await writeFile(
      resolve(testDataPath, 'acessos.csv'),
      'mes;produto_digital;total_logins;usuarios_unicos;empresas_clientes_distintas\n' +
        '2026-09;Portal Web;10;11;2\n',
      'utf8',
    );
    let response = await page.request.get('/api/acessos');
    let payload = await response.json();
    expect(payload.status).toBe('stale');
    expect(payload.rejections).toContainEqual(expect.objectContaining({
      file: 'acessos.csv',
      reasons: ['acessos.csv: usuarios_unicos supera total_logins na linha 2.'],
    }));
    expect(payload.indicators.combinations).toContainEqual(expect.objectContaining({
      month: '2026-09', product: 'Portal Web', totalLogins: 1200,
    }));

    await cp(resolve(validLoadPath, 'acessos.csv'), resolve(testDataPath, 'acessos.csv'));
    await writeFile(
      resolve(testDataPath, 'ranking_acessos.csv'),
      'mes;produto_digital;posicao;empresa_id_opaco;total_logins;usuarios_unicos\n' +
        '2026-09;Portal Web;1;EMP-ALFA;100;20\n' +
        '2026-09;Portal Web;2;EMP-BETA;200;30\n',
      'utf8',
    );
    response = await page.request.get('/api/acessos');
    payload = await response.json();
    expect(payload.status).toBe('stale');
    expect(payload.rejections).toContainEqual(expect.objectContaining({
      file: 'ranking_acessos.csv',
      reasons: ['ranking_acessos.csv: posições não seguem ordem decrescente de logins.'],
    }));
    expect(payload.ranking).toContainEqual(expect.objectContaining({
      month: '2026-09', product: 'Portal Web', companyId: 'EMP-ALFA', totalLogins: 500,
    }));
  });

  test('mantém o ranking consultável quando acessos.csv é inválido e não há cache', async ({ page }) => {
    await writeFile(
      resolve(testDataPath, 'acessos.csv'),
      'mes;produto_digital;total_logins;usuarios_unicos;empresas_clientes_distintas\n' +
        '2026-09;Portal Web;10;11;2\n',
      'utf8',
    );

    await page.goto('/painel.html');
    const response = await page.request.get('/api/acessos');
    const payload = await response.json();
    expect(payload.status).toBe('partial');
    expect(payload.indicators.combinations).toEqual([]);
    expect(payload.ranking).not.toEqual([]);
    expect(payload.rejections).toContainEqual(expect.objectContaining({ file: 'acessos.csv' }));

    const periodFilter = page.getByLabel('Período analisado');
    const productFilter = page.getByLabel('Produto Digital');
    await expect(periodFilter).toBeEnabled();
    await expect(productFilter).toBeEnabled();
    await expect(periodFilter).toHaveValue('2026-09');
    await expect(productFilter).toHaveValue('Portal Web');

    const usersPanel = page.getByRole('tabpanel', { name: 'Usuários e Acessos' });
    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Usuários e Acessos', exact: true })
      .click();
    await expect(usersPanel.locator('[data-access-value="total-logins"]')).toHaveText('Indisponível');
    await expect(usersPanel.locator('[data-access-value="unique-users"]')).toHaveText('Indisponível');
    await expect(usersPanel.locator('[data-access-value="distinct-companies"]')).toHaveText('Indisponível');

    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Empresas', exact: true })
      .click();
    const ranking = page.getByRole('tabpanel', { name: 'Empresas' }).locator('#access-ranking');
    await expect(ranking.getByText('Origem: MySQL · Estado: pronto', { exact: true })).toBeVisible();
    await expect(ranking.locator('tbody tr')).toHaveCount(3);
    await expect(ranking.locator('tbody tr').first()).toContainText('EMP-ALFA');
    await expect(ranking.locator('#access-ranking-coverage')).toHaveText('Ranking com dados prontos');
    await expect(ranking.getByText('0', { exact: true })).toHaveCount(0);
  });

  test('distingue combinação ausente de zero explícito e mantém o aviso de arquivo ausente', async ({ page }) => {
    await page.goto('/painel.html');
    await rm(resolve(testDataPath, 'ranking_acessos.csv'));

    await page.reload();
    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Usuários e Acessos', exact: true })
      .click();
    const usersPanel = page.getByRole('tabpanel', { name: 'Usuários e Acessos' });
    await expect(usersPanel.getByText('Fonte do ranking não atualizada', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Produto Digital').locator('option', { hasText: 'Loja Aplicativo' })).toHaveCount(1);
    await page.getByLabel('Produto Digital').selectOption('Loja Aplicativo');
    await expect(usersPanel.locator('[data-access-value="total-logins"]')).toHaveText('0');
    await expect(usersPanel.locator('[data-access-value="unique-users"]')).toHaveText('0');

    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Empresas', exact: true })
      .click();
    const ranking = page.getByRole('tabpanel', { name: 'Empresas' }).locator('#access-ranking');
    await expect(ranking.locator('tbody').getByText('Ranking não informado para esta combinação.', { exact: true })).toBeVisible();
    await expect(ranking.getByText('0', { exact: true })).toHaveCount(0);

    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Usuários e Acessos', exact: true })
      .click();
    await page.getByLabel('Período analisado').selectOption('2026-08');
    await expect(page.getByLabel('Produto Digital').locator('option')).toHaveText(['Portal Web', 'Aplicativo']);
    await expect(usersPanel.getByText('Loja Web e Loja Aplicativo: não informado neste período.', { exact: true })).toBeVisible();
  });

  test('ranking inválido sem cache aparece indisponível e nunca como pronto', async ({ page }) => {
    await writeFile(
      resolve(testDataPath, 'ranking_acessos.csv'),
      'mes;produto_digital;posicao;empresa_id_opaco;total_logins;usuarios_unicos\n' +
        '2026-09;Portal Web;1;EMP-ALFA;100;20\n' +
        '2026-09;Portal Web;2;EMP-BETA;200;30\n',
      'utf8',
    );

    await page.goto('/painel.html');
    const response = await page.request.get('/api/acessos');
    const payload = await response.json();
    expect(payload.status).toBe('partial');
    expect(payload.ranking).toEqual([]);
    expect(payload.rankingSource).toBeNull();

    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Empresas', exact: true })
      .click();
    const ranking = page.getByRole('tabpanel', { name: 'Empresas' }).locator('#access-ranking');
    await expect(ranking.locator('#access-ranking-coverage')).toHaveText('Ranking indisponível');
    await expect(ranking.locator('#access-ranking-source-state')).toHaveText('Sem arquivo válido');
    await expect(ranking.locator('tbody')).toContainText('Ranking indisponível sem arquivo válido.');
    await expect(ranking.getByText('Ranking com dados prontos', { exact: true })).toHaveCount(0);
  });

  test('ranking preservado após rejeição aparece desatualizado', async ({ page }) => {
    await page.goto('/painel.html');
    await writeFile(
      resolve(testDataPath, 'ranking_acessos.csv'),
      'mes;produto_digital;posicao;empresa_id_opaco;total_logins;usuarios_unicos\n' +
        '2026-09;Portal Web;1;EMP-ALFA;100;20\n' +
        '2026-09;Portal Web;2;EMP-BETA;200;30\n',
      'utf8',
    );
    await page.reload();
    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Empresas', exact: true })
      .click();
    const ranking = page.getByRole('tabpanel', { name: 'Empresas' }).locator('#access-ranking');
    await expect(ranking.locator('#access-ranking-coverage')).toHaveText('Ranking desatualizado');
    await expect(ranking.locator('#access-ranking-source-state')).toHaveText('Última carga válida preservada');
    await expect(ranking.locator('tbody tr')).toHaveCount(3);
  });

  test('aceita estado parcial e exibe todos os metadados dos dois arquivos', async ({ page }) => {
    const manifestPath = resolve(testDataPath, 'manifesto_carga.csv');
    const { readFile } = await import('node:fs/promises');
    const manifest = await readFile(manifestPath, 'utf8');
    await writeFile(
      manifestPath,
      manifest
        .replace(
          '1.0;acessos.csv;2026-09-30T23:59:00-03:00;2026-08-01;2026-09-30;false;mysql;pronto;Agregados sintéticos por mês e Produto Digital',
          '1.0;acessos.csv;2026-09-30T23:59:00-03:00;2026-08-01;2026-09-30;true;mysql;parcial;Setembro sintético ainda incompleto',
        )
        .replace(
          '1.0;ranking_acessos.csv;2026-09-30T23:59:00-03:00;2026-08-01;2026-09-30;false;mysql;pronto;Ranking sintético com empresas anônimas',
          '1.0;ranking_acessos.csv;2026-09-30T23:59:00-03:00;2026-08-01;2026-09-30;true;mysql;parcial;Ranking sintético ainda incompleto',
        ),
      'utf8',
    );

    await page.goto('/painel.html');
    const response = await page.request.get('/api/acessos');
    const payload = await response.json();
    expect(payload.status).toBe('ready');
    expect(payload.source).toMatchObject({ state: 'parcial', partial: true });
    expect(payload.rankingSource).toMatchObject({ state: 'parcial', partial: true });
    expect(payload.indicators.combinations).toEqual(expect.arrayContaining([
      expect.objectContaining({ month: '2026-09', product: 'Portal Web', coverage: 'partial' }),
      expect.objectContaining({ month: '2026-09', product: 'Loja Web', coverage: 'partial' }),
    ]));
    expect(payload.ranking).toEqual(expect.arrayContaining([
      expect.objectContaining({ month: '2026-09', product: 'Portal Web', coverage: 'partial' }),
    ]));

    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Usuários e Acessos', exact: true })
      .click();
    const sourceSummary = page.getByRole('article', { name: 'Estado dos arquivos de Acessos' });
    await expect(sourceSummary.getByText('Origem: MySQL · Estado: parcial', { exact: true })).toHaveCount(2);
    await expect(sourceSummary.getByText('Abrangência: 01/08/2026 a 30/09/2026', { exact: true })).toHaveCount(2);
    await expect(sourceSummary.getByText('Geração: 30/09/2026', { exact: false })).toHaveCount(2);
    await expect(sourceSummary.getByText('Período parcial', { exact: true })).toHaveCount(2);
    await expect(sourceSummary.getByText('Observação: Setembro sintético ainda incompleto', { exact: true })).toBeVisible();
    await expect(sourceSummary.getByText('Observação: Ranking sintético ainda incompleto', { exact: true })).toBeVisible();
    await expect(page.locator('#access-coverage')).toHaveText('Cobertura parcial');
  });

  test('mantém o cabeçalho da Visão geral coerente com o período filtrado e sem afirmação fictícia', async ({ page }) => {
    await page.goto('/painel.html');
    const overview = page.getByRole('tabpanel', { name: 'Visão geral' });
    await expect(overview.getByRole('heading', { name: 'Visão geral de setembro de 2026', exact: true })).toBeVisible();
    await expect(overview.getByText('Leitura dos indicadores da Lyra M2M, comparada a agosto de 2026.', { exact: true })).toBeVisible();
    await expect(overview.getByText('+8,4%', { exact: true })).toHaveCount(0);
    await expect(overview.getByText('Mais usuários e mais logins no período', { exact: true })).toHaveCount(0);
    await expect(overview.getByText('Comparação de Acessos', { exact: true })).toBeVisible();

    await page.getByLabel('Período analisado').selectOption('2026-08');
    await expect(overview.getByRole('heading', { name: 'Visão geral de agosto de 2026', exact: true })).toBeVisible();
    await expect(overview.getByText('Leitura dos indicadores da Lyra M2M, comparada a julho de 2026.', { exact: true })).toBeVisible();
    await expect(overview.getByText('Sem período anterior comparável', { exact: true })).toBeVisible();
  });

});


test.describe('Issue #7 · Telas do Aplicativo e evidências do Google Analytics', () => {
  test('mostra somente o total observado e mantém classes técnicas e eventos como evidências distintas', async ({ page }) => {
    await page.goto('/painel.html');

    const response = await page.request.get('/api/telas-aplicativo');
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      status: 'ready',
      indicators: {
        property: { name: 'App M2M sintético', id: 'GA-PROP-TEST-01' },
        totalViews: 7142,
        totalEvidence: 'observado',
        technicalClasses: [
          { item: 'HomeActivity', count: 2210, evidence: 'observado' },
          { item: 'LinesFragment', count: 1748, evidence: 'derivado' },
        ],
        eventTotals: [
          { item: 'Total de eventos', count: 9650, users: 1204, evidence: 'observado' },
        ],
        events: [
          { item: 'login', count: 930, users: 284, evidence: 'nao_validado', accessEligible: false },
          { item: 'invoice_open', count: 612, users: 191, evidence: 'observado', accessEligible: false },
        ],
      },
    });

    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Telas', exact: true })
      .click();
    const applicationCard = page.locator('#application-screens-card');
    await expect(applicationCard.getByText('7.142', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Total observado', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Total de eventos: 9.650 · Observado', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('HomeActivity', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('LinesFragment', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Classe técnica · Observado', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Classe técnica · Derivado', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('login', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Evento · Não validado', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('O evento login não substitui Acesso', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Origem: Google Analytics · Estado: pronto', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Abrangência: 01/08/2026 a 30/09/2026', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Propriedade: App M2M sintético · ID: GA-PROP-TEST-01', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Período completo', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Gerado em:', { exact: false })).toBeVisible();
    await expect(applicationCard.getByText('Observação: Export sintético com classes técnicas e eventos funcionais', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Contrato: 1.0', { exact: true })).toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Usuários e Acessos' }).getByText('930', { exact: true })).toHaveCount(0);
    const privateFileResponse = await page.request.get('/tests/fixtures/carga-usuarios-valida/telas_aplicativo.csv');
    expect(privateFileResponse.status()).toBe(404);
  });

  test('mantém a coluna final dos metadados legível em 1366px', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/painel.html');
    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Telas', exact: true })
      .click();

    const layout = await page.locator('#application-screens-card').evaluate((card) => {
      const rows = [...card.querySelectorAll('.source-file-row')];
      return rows.map((row) => {
        const rowRect = row.getBoundingClientRect();
        const cells = [...row.children].map((cell) => cell.getBoundingClientRect());
        return {
          columns: getComputedStyle(row).gridTemplateColumns.split(' ').length,
          finalColumnWidth: cells.at(-1).width,
          contained: cells.every((cell) => cell.right <= rowRect.right + 1),
        };
      });
    });

    expect(layout).toHaveLength(3);
    expect(layout.every((row) => row.columns === 2)).toBe(true);
    expect(layout.every((row) => row.finalColumnWidth >= 200)).toBe(true);
    expect(layout.every((row) => row.contained)).toBe(true);
  });

  test('rejeita PII em unidade_contagem sem substituir o cache válido', async ({ page }) => {
    await page.goto('/painel.html');

    const validResponse = await page.request.get('/api/telas-aplicativo');
    const validPayload = await validResponse.json();
    expect(validPayload.status).toBe('ready');
    expect(validPayload.indicators.totalViews).toBe(7142);

    await writeFile(
      resolve(testDataPath, 'telas_aplicativo.csv'),
      'periodo;produto;fonte;propriedade;property_id;tipo_registro;item;contagem;usuarios;unidade_contagem;metrica_usuarios;evidencia;observacao\n' +
        '2026-08-01 a 2026-09-30;Aplicativo M2M;Google Analytics;App M2M sintético;GA-PROP-TEST-01;total_telas;Total;99999;;pessoa@example.com;;observado;Tentativa sintética recusada\n',
      'utf8',
    );

    const rejectedResponse = await page.request.get('/api/telas-aplicativo');
    const rejectedPayload = await rejectedResponse.json();
    expect(rejectedPayload.status).toBe('stale');
    expect(rejectedPayload.indicators.totalViews).toBe(7142);
    expect(rejectedPayload.rejection).toMatchObject({
      file: 'telas_aplicativo.csv',
      reasons: ['telas_aplicativo.csv: conteúdo contém PII conhecida na linha 2.'],
    });
    expect(rejectedPayload.rejection.attemptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(rejectedPayload)).not.toContain('pessoa@example.com');

    const cacheText = await readFile(resolve(testCachePath, 'telas_aplicativo.json'), 'utf8');
    const rejectionLog = await readFile(resolve(testCachePath, 'validation-rejections.jsonl'), 'utf8');
    expect(cacheText).not.toContain('pessoa@example.com');
    expect(rejectionLog).not.toContain('pessoa@example.com');

    await rm(resolve(testDataPath, 'telas_aplicativo.csv'));
    const missingResponse = await page.request.get('/api/telas-aplicativo');
    const missingPayload = await missingResponse.json();
    expect(missingPayload.status).toBe('stale');
    expect(missingPayload.indicators.totalViews).toBe(7142);
    expect(JSON.stringify(missingPayload)).not.toContain('pessoa@example.com');
  });

  test('rejeita total não observado e preserva o cache sem registrar conteúdo da linha', async ({ page }) => {
    await page.goto('/painel.html');
    await writeFile(
      resolve(testDataPath, 'telas_aplicativo.csv'),
      'periodo;produto;fonte;propriedade;property_id;tipo_registro;item;contagem;usuarios;unidade_contagem;metrica_usuarios;evidencia;observacao\n' +
        '2026-08-01 a 2026-09-30;Aplicativo M2M;Google Analytics;App M2M sintético;GA-PROP-TEST-01;total_telas;Total;99999;;visualizacoes;;derivado;Tentativa sintética recusada\n',
      'utf8',
    );

    const response = await page.request.get('/api/telas-aplicativo');
    const payload = await response.json();
    expect(payload.status).toBe('stale');
    expect(payload.indicators.totalViews).toBe(7142);
    expect(payload.rejection).toMatchObject({ file: 'telas_aplicativo.csv' });
    expect(payload.rejection.attemptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.rejection.reasons).toEqual([
      'telas_aplicativo.csv: total_telas deve ter contagem observada na linha 2.',
    ]);
    expect(JSON.stringify(payload.rejection)).not.toContain('99999');
    expect(JSON.stringify(payload.rejection)).not.toContain('Tentativa sintética recusada');

    await page.reload();
    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Telas', exact: true })
      .click();
    const applicationCard = page.locator('#application-screens-card');
    await expect(applicationCard.getByText('Última carga válida preservada', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('7.142', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('99.999', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Tentativa sintética recusada', { exact: false })).toHaveCount(0);
  });

  test('arquivo ausente preserva o cache e avisa que a fonte não foi atualizada', async ({ page }) => {
    await page.goto('/painel.html');
    await rm(resolve(testDataPath, 'telas_aplicativo.csv'));

    await page.reload();
    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Telas', exact: true })
      .click();
    const applicationCard = page.locator('#application-screens-card');
    await expect(applicationCard.getByText('Fonte não atualizada', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('7.142', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('O evento login não substitui Acesso', { exact: true })).toBeVisible();
  });

  test('sem cache, arquivo inválido deixa telas do Aplicativo indisponíveis e nunca vira zero', async ({ page }) => {
    await writeFile(
      resolve(testDataPath, 'telas_aplicativo.csv'),
      'periodo;produto;fonte;propriedade;property_id;tipo_registro;item;contagem;usuarios;unidade_contagem;metrica_usuarios;evidencia;observacao\n' +
        '2026-08-01 a 2026-09-30;Aplicativo M2M;Google Analytics;App M2M sintético;GA-PROP-TEST-01;classe_tela;HomeActivity;0;;visualizacoes;;observado;Classe técnica\n',
      'utf8',
    );

    await page.goto('/painel.html');
    const response = await page.request.get('/api/telas-aplicativo');
    const payload = await response.json();
    expect(payload.status).toBe('unavailable');
    expect(payload.indicators.totalViews).toBeNull();
    expect(payload.indicators.technicalClasses).toEqual([]);
    expect(payload.indicators.events).toEqual([]);

    await page.getByRole('tablist', { name: 'Áreas do painel' })
      .getByRole('tab', { name: 'Telas', exact: true })
      .click();
    const applicationCard = page.locator('#application-screens-card');
    await expect(applicationCard.locator('#application-total-views')).toHaveText('Indisponível');
    await expect(applicationCard.getByText('0', { exact: true })).toHaveCount(0);
    await expect(applicationCard.getByText('Sem classes técnicas validadas', { exact: true })).toBeVisible();
    await expect(applicationCard.getByText('Sem eventos funcionais validados', { exact: true })).toBeVisible();
  });
});
