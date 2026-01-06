import { useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';
import senLogo from '@/assets/sen-logo.jpg';

export function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAdmin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(password)) {
      setError('Mot de passe incorrect');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="fixed inset-0 grid-background grid-fade pointer-events-none" />
      <div className="w-full max-w-sm p-8 relative">
        <div className="text-center mb-8 animate-fade-in">
          <img
            src={senLogo}
            alt="SEN STUDIO"
            className="h-16 mx-auto mb-6"
          />
          <h1 className="text-xl font-semibold text-foreground">Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connectez-vous pour gérer vos produits
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 animate-slide-up">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="pl-10"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <Button type="submit" className="w-full" size="lg">
            Connexion
          </Button>
        </form>
      </div>
    </div>
  );
}
