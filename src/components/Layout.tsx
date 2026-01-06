import { ReactNode } from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
  showGrid?: boolean;
}

export function Layout({ children, showGrid = true }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col relative">
      {showGrid && (
        <div className="fixed inset-0 grid-background grid-fade pointer-events-none" />
      )}
      <Header />
      <main className="flex-1 relative">{children}</main>
      <footer className="border-t border-border py-6 relative">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} SEN STUDIO. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}
