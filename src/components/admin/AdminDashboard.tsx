import { useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAdminProducts } from '@/hooks/useAdminProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, LogOut, Pencil, Trash2, Package, Loader2 } from 'lucide-react';
import { Product } from '@/contexts/CartContext';
import senLogo from '@/assets/sen-logo.jpg';

export function AdminDashboard() {
  const { logout } = useAdmin();
  const { products, loading, createProduct, updateProduct, deleteProduct } = useAdminProducts();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_fcfa: '',
    image_url: '',
    file_url: '',
    category: '',
    allow_multiple: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price_fcfa: '',
      image_url: '',
      file_url: '',
      category: '',
      allow_multiple: true,
    });
    setEditingProduct(null);
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        price_fcfa: product.price_fcfa.toString(),
        image_url: product.image_url,
        file_url: product.file_url,
        category: product.category || '',
        allow_multiple: product.allow_multiple !== false, // Default to true if undefined
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const productData = {
      name: formData.name,
      description: formData.description || null,
      price_fcfa: parseFloat(formData.price_fcfa),
      image_url: formData.image_url,
      file_url: formData.file_url,
      category: formData.category || null,
      is_active: true,
      allow_multiple: formData.allow_multiple,
    };

    if (editingProduct) {
      await updateProduct(editingProduct.id, productData);
    } else {
      await createProduct(productData);
    }

    setSaving(false);
    closeModal();
  };

  const handleDelete = async (productId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      await deleteProduct(productId);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 grid-background grid-fade pointer-events-none" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src={senLogo} alt="SEN STUDIO" className="h-10" />
            <span className="text-sm font-medium text-muted-foreground">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => openModal()} className="gap-2">
              <Plus className="w-4 h-4" />
              Nouveau Produit
            </Button>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container py-8 relative">
        <div className="flex items-center gap-2 mb-6">
          <Package className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Produits ({products.length})</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {products.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors opacity-0 animate-slide-up"
                style={{ animationDelay: `${index * 0.03}s`, animationFillMode: 'forwards' }}
              >
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-16 h-16 object-cover rounded-md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground truncate">{product.name}</h3>
                    {!product.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                        Inactif
                      </span>
                    )}
                    {product.allow_multiple === false && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 rounded">
                        Unique
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{product.description}</p>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-primary">
                    {product.price_fcfa.toLocaleString('fr-FR')} FCFA
                  </span>
                  {product.category && (
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openModal(product)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(product.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {products.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucun produit</p>
                <p className="text-sm">Cliquez sur "Nouveau Produit" pour commencer</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Product Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nom du produit *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Pack Icons Premium"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du produit..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Prix (FCFA) *</label>
                <Input
                  type="number"
                  value={formData.price_fcfa}
                  onChange={(e) => setFormData({ ...formData, price_fcfa: e.target.value })}
                  placeholder="15000"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Catégorie</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Design"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">URL de l'image *</label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">URL du fichier digital *</label>
              <Input
                value={formData.file_url}
                onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                placeholder="https://..."
                required
              />
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="allow-multiple"
                checked={formData.allow_multiple}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_multiple: checked })}
              />
              <Label htmlFor="allow-multiple">Autoriser plusieurs exemplaires dans le panier</Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingProduct ? (
                  'Enregistrer'
                ) : (
                  'Créer'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
