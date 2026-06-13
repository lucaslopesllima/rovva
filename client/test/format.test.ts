import { describe, it, expect } from 'vitest';
import { brl, brl0, fmtDate, todayStr } from '../src/lib/format.ts';

// Intl usa NBSP entre "R$" e o número — normaliza para comparar.
const plain = (s: string): string => s.replace(/ /g, ' ');

describe('format', () => {
  it('brl formata com centavos', () => {
    expect(plain(brl(1234.5))).toBe('R$ 1.234,50');
    expect(plain(brl(0))).toBe('R$ 0,00');
  });

  it('brl0 arredonda sem centavos', () => {
    expect(plain(brl0(1234.5))).toBe('R$ 1.235');
    expect(plain(brl0(5000))).toBe('R$ 5.000');
  });

  it('fmtDate converte ISO sem shift de fuso', () => {
    expect(fmtDate('2026-06-12')).toBe('12/06/2026');
    expect(fmtDate('2026-01-01')).toBe('01/01/2026'); // viraria 31/12 com shift
  });

  it('todayStr devolve YYYY-MM-DD', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
