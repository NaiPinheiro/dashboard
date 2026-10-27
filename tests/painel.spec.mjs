import { expect, test } from '@playwright/test';

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
    page.getByText('MVP visual · todos os dados são fictícios'),
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
