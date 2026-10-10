import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Collapse, Segmented } from '../src/lib/ui.tsx';

describe('Controles compartilhados', () => {
  it('retira filtros recolhidos da navegação e restaura seus valores ao abrir', () => {
    const { rerender } = render(<Collapse open={false}><input aria-label="Filtro" defaultValue="Campinas" /></Collapse>);
    expect(screen.queryByRole('textbox', { name: 'Filtro' })).toBeNull();
    expect(screen.getByDisplayValue('Campinas').closest('[inert]')).not.toBeNull();
    rerender(<Collapse open><input aria-label="Filtro" defaultValue="Campinas" /></Collapse>);
    expect(screen.getByRole('textbox', { name: 'Filtro' })).toHaveValue('Campinas');
    expect(screen.getByRole('textbox').closest('[inert]')).toBeNull();
  });

  it('alterna visualização sem enviar o formulário', () => {
    const change = vi.fn();
    const submit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<form onSubmit={submit}><Segmented value="lista" onChange={change}
      options={[{ value: 'lista', label: 'Lista' }, { value: 'mapa', label: 'Mapa' }]} /></form>);
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    expect(change).toHaveBeenCalledWith('mapa');
    expect(submit).not.toHaveBeenCalled();
  });
});
