import { render, screen } from '@testing-library/react';
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
      'h-[calc(100dvh-var(--estoque-shell-offset))]',
      'min-h-0',
      'overflow-hidden',
    );
    expect(workspace).not.toHaveClass('overflow-auto', 'overflow-y-auto');
    expect(header).toHaveClass('h-11', 'shrink-0');
    expect(toolbar).toHaveClass('h-11', 'shrink-0');
    expect(viewport).toHaveClass('min-h-0', 'flex-1', 'overflow-auto');
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
