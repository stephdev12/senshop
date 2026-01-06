import { Layout } from '@/components/Layout';
import { ProductGrid } from '@/components/ProductGrid';
import { useProducts } from '@/hooks/useProducts';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { products, loading, error } = useProducts();

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 md:mb-16 animate-fade-in">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Produits Digitaux Premium
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Découvrez notre collection de ressources digitales pour créateurs et designers.
          </p>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-destructive">{error}</p>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </Layout>
  );
};

export default Index;
