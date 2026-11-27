import { ThemeProvider } from 'next-themes';
import type { PropsWithChildren } from 'react';

export function PelegriniThemeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="theme">
      {children}
    </ThemeProvider>
  );
}
