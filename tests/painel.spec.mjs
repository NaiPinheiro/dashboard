import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
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
  ['Visão geral', 'Visão geral de setembro'],
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
    page.getByText('Dados mistos · Usuários carregados; demais indicadores fictícios'),
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
    page.getByRole('heading', { name: 'Visão geral de setembro', exact: true }),
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
  await expect(usersPanel.getByText('Origem: MySQL · Estado: pronto', { exact: true })).toHaveCount(2);
  await expect(usersPanel.getByText('Abrangência: 01/08/2026 a 30/09/2026', { exact: true })).toBeVisible();

  await navigation.getByRole('tab', { name: 'Empresas', exact: true }).click();
  const companiesPanel = page.getByRole('tabpanel', { name: 'Empresas' });
  await expect(companiesPanel.getByText('EMP-001', { exact: true })).toBeVisible();
  await expect(companiesPanel.getByText('12', { exact: true })).toBeVisible();

  const privateFileResponse = await page.request.get('/tests/fixtures/carga-usuarios-valida/usuarios.csv');
  expect(privateFileResponse.status()).toBe(404);
  const missingPublicAsset = await page.request.get('/assets/missing.css');
  expect(missingPublicAsset.status()).toBe(404);
});


test('uma tentativa inválida preserva a última carga válida de Usuários', async ({ page }) => {
  await page.goto('/painel.html');
  await expect(page.getByText('Dados mistos · Usuários carregados; demais indicadores fictícios')).toBeVisible();

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
  await expect(page.getByText('Dados mistos · Usuários carregados; demais indicadores fictícios')).toBeVisible();

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
    await expect(usersPanel.getByText('Última carga válida preservada')).toBeVisible();
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
  await expect(page.getByText('Dados mistos · Usuários carregados; demais indicadores fictícios')).toBeVisible();

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
