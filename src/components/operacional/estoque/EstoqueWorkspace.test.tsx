import { render, screen } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { describe, expect, it } from 'vitest';

import {
  EstoqueDataViewport,
  EstoqueToolbar,
  EstoqueWorkspace,
  EstoqueWorkspaceHeader,
} from './EstoqueWorkspace';

describe('EstoqueWorkspace', () => {
  it('mantem as barras fixas e apenas o viewport de dados rolavel', () => {
    render(
      <EstoqueWorkspace>
        <EstoqueWorkspaceHeader>Abas</EstoqueWorkspaceHeader>
        <EstoqueToolbar>Comandos</EstoqueToolbar>
        <EstoqueDataViewport>Tabela</EstoqueDataViewport>
      </EstoqueWorkspace>,
    );

    const workspace = screen.getByRole('region', { name: 'Mesa operacional de estoque' });
    const header = screen.getByRole('banner', { name: 'Navegacao do estoque' });
    const toolbar = screen.getByRole('toolbar', { name: 'Comandos do estoque' });
    const viewport = screen.getByRole('region', { name: 'Dados do estoque' });

    expect(workspace).toHaveClass(
      'h-[calc(100dvh-var(--estoque-shell-offset,0px))]',
      'min-h-0',
      'overflow-hidden',
    );
    expect(workspace).not.toHaveClass('overflow-auto', 'overflow-y-auto');
    expect(header).toHaveClass('h-10', 'shrink-0');
    expect(header).toHaveClass('max-md:pl-14');
    expect(toolbar).toHaveClass('h-10', 'shrink-0');
    expect(toolbar).toHaveClass('flex-nowrap', 'overflow-x-auto');
    expect(viewport).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden');
    expect(viewport).not.toHaveClass('overflow-auto', 'overflow-y-auto', 'overflow-x-auto');
  });

  it('mantem fallback sem bloquear offset por estilo, classe ou ancestral', () => {
    render(
      <>
        <EstoqueWorkspace
          aria-label="Offset local"
          style={{ '--estoque-shell-offset': '6rem' } as CSSProperties}
        />
        <div style={{ '--estoque-shell-offset': '4rem' } as CSSProperties}>
          <EstoqueWorkspace aria-label="Offset herdado" />
        </div>
        <EstoqueWorkspace
          aria-label="Altura por classe"
          className="h-[calc(100dvh-8rem)]"
        />
      </>,
    );

    const local = screen.getByRole('region', { name: 'Offset local' });
    const inherited = screen.getByRole('region', { name: 'Offset herdado' });
    const byClass = screen.getByRole('region', { name: 'Altura por classe' });

    expect(local.style.getPropertyValue('--estoque-shell-offset')).toBe('6rem');
    expect(inherited.style.getPropertyValue('--estoque-shell-offset')).toBe('');
    expect(inherited.parentElement?.style.getPropertyValue('--estoque-shell-offset')).toBe('4rem');
    expect(inherited).toHaveClass('h-[calc(100dvh-var(--estoque-shell-offset,0px))]');
    expect(byClass).toHaveClass('h-[calc(100dvh-8rem)]');
    expect(byClass).not.toHaveClass('h-[calc(100dvh-var(--estoque-shell-offset,0px))]');
  });

  it('permite complementar classes sem perder as regras estruturais', () => {
    render(
      <EstoqueWorkspace className="workspace-extra">
        <EstoqueWorkspaceHeader className="header-extra">Abas</EstoqueWorkspaceHeader>
        <EstoqueToolbar className="toolbar-extra">Comandos</EstoqueToolbar>
        <EstoqueDataViewport className="viewport-extra">Tabela</EstoqueDataViewport>
      </EstoqueWorkspace>,
    );

    expect(screen.getByRole('region', { name: 'Mesa operacional de estoque' })).toHaveClass('workspace-extra');
    expect(screen.getByRole('banner', { name: 'Navegacao do estoque' })).toHaveClass('header-extra');
    expect(screen.getByRole('toolbar', { name: 'Comandos do estoque' })).toHaveClass('toolbar-extra');
    expect(screen.getByRole('region', { name: 'Dados do estoque' })).toHaveClass('viewport-extra');
  });
});
