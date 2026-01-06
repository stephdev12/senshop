import { Link } from 'react-router-dom';
import { CartDropdown } from './CartDropdown';
import senLogo from '@/assets/sen-logo.jpg';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container flex items-center justify-between h-16 md:h-18">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={senLogo}
            alt="SEN STUDIO"
            className="h-10 md:h-12 w-auto"
          />
        </Link>
        <CartDropdown />
      </div>
    </header>
  );
}
