// Seletor de org do master: lista as orgs e troca o token.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrgSwitcher } from '../src/App.tsx';
import { api, getToken } from '../src/lib/api.ts';

vi.mock('../src/lib/api.ts', async (orig) => {
  const real = await orig() as Record<string, unknown>;
  return { ...real, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});
const m = vi.mocked(api);

describe('OrgSwitcher', () => {
  it('troca de org e grava o token novo', async () => {
    m.get.mockResolvedValue({ orgs: [{ id: 1, nome: 'Org Um' }, { id: 2, nome: 'Org Dois' }] });
    m.post.mockResolvedValue({ token: 'tok-org2' });
    render(<OrgSwitcher orgId={1} />);
    await screen.findByText('Org Dois');
    await userEvent.selectOptions(screen.getByLabelText('Trocar organização'), '2');
    await waitFor(() => expect(m.post).toHaveBeenCalledWith('/api/auth/switch-org', { org_id: 2 }));
    await waitFor(() => expect(getToken()).toBe('tok-org2'));
  });
});
