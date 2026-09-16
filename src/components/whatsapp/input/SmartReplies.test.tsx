import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SmartReplies } from './SmartReplies';

describe('SmartReplies', () => {
  it('usa somente o indicador compartilhado sem reduzir a barra durante o carregamento', () => {
    const { container } = render(
      <SmartReplies replies={[]} onSelect={vi.fn()} isVisible isLoading />,
    );

    const bar = screen.getByText('Sugestões IA').closest('[aria-busy="true"]');

    expect(bar).toHaveClass('min-h-11');
    expect(screen.getAllByTestId('loading-indicator')).toHaveLength(1);
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });
});
