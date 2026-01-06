import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="fixed inset-0 grid-background grid-fade pointer-events-none" />
      <div className="text-center relative animate-fade-in">
        <h1 className="text-8xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Page introuvable
        </p>
        <Button asChild className="gap-2">
          <Link to="/">
            <Home className="w-4 h-4" />
            Retour à l'accueil
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
