import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClientesHeroSection } from './ClientesHeroSection';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.stubGlobal('requestAnimationFrame', () => 1);
vi.stubGlobal('cancelAnimationFrame', () => undefined);

describe('client analysis experience', () => {
  it('keeps long totals fluid and explains business expressions', () => {
    const { container } = render(
      <TooltipProvider>
        <ClientesHeroSection
          qtdClientes={1234567}
          novosClientes={321}
          faturamentoLiquido={123456789.9}
          ticketMedio={9876543.21}
          qtdVendedores={88}
          evolucaoMensal={[]}
        />
      </TooltipProvider>,
    );

    expect(container.querySelectorAll('.pelegrini-responsive-value')).toHaveLength(5);
    expect(screen.getByRole('button', { name: /O que significa Receita Gerada/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /O que significa Ticket Médio/i })).toBeInTheDocument();
  });

  it('removes the top-five client donut from the client analysis page', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/pages/comercial/ClientesAnalysePageLegacy.tsx'),
      'utf8',
    );

    expect(source).not.toContain('Top 5 Clientes — Representatividade');
    expect(source).not.toContain('<PieChart>');
  });

  it('keeps branch choices out of both module home screens', () => {
    const desktop = readFileSync(join(process.cwd(), 'src/pages/HomePage.tsx'), 'utf8');
    const mobile = readFileSync(join(process.cwd(), 'src/pages/HomeMobilePage.tsx'), 'utf8');

    expect(desktop).not.toContain('PelegriniBranchSwitcher');
    expect(desktop).not.toContain('PelegriniBranchPanel');
    expect(mobile).not.toContain('PelegriniBranchSwitcher');
    expect(mobile).not.toContain('PelegriniBranchPanel');
  });
});
