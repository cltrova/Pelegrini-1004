import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

describe('TooltipContent', () => {
  it('renders outside constrained navigation containers', () => {
    render(
      <TooltipProvider>
        <aside data-testid="constrained-container">
          <Tooltip defaultOpen>
            <TooltipTrigger>Ajuda</TooltipTrigger>
            <TooltipContent data-testid="tooltip-content">Texto auxiliar</TooltipContent>
          </Tooltip>
        </aside>
      </TooltipProvider>,
    );

    const container = screen.getByTestId('constrained-container');
    const content = screen.getByTestId('tooltip-content');

    expect(container).not.toContainElement(content);
    expect(document.body).toContainElement(content);
  });
});
