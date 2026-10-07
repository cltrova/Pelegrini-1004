export function SidebarVersion() {
  return (
    <p
      aria-label={`Versão ${__APP_VERSION__}`}
      data-testid="sidebar-version"
      className="pt-2 text-center text-[10px] leading-4 tabular-nums text-sidebar-foreground/50"
    >
      {__APP_VERSION__}
    </p>
  );
}
