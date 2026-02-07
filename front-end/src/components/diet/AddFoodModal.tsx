import { useState, useMemo } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFoods, useCreateFood } from "@/hooks/use-foods";
import { useAddMealItem } from "@/hooks/use-diet";
import { toast } from "@/hooks/use-toast";
import type { FoodItemResponse } from "@/lib/types";

const emptyFoodForm = { name: "", brand: "", protein: "", carbs: "", fat: "" };

interface AddFoodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealId: number;
}

export function AddFoodModal({ open, onOpenChange, mealId }: AddFoodModalProps) {
  const [search, setSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodItemResponse | null>(null);
  const [grams, setGrams] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [foodForm, setFoodForm] = useState(emptyFoodForm);

  const { data: foods, isLoading } = useFoods(search, 0, 20);
  const addItem = useAddMealItem();
  const createFood = useCreateFood();

  // Auto-calculate calories from macros
  const computedCalories = useMemo(() => {
    const pro = parseFloat(foodForm.protein) || 0;
    const carb = parseFloat(foodForm.carbs) || 0;
    const fat = parseFloat(foodForm.fat) || 0;
    return Math.round((pro * 4 + carb * 4 + fat * 9) * 100) / 100;
  }, [foodForm.protein, foodForm.carbs, foodForm.fat]);

  const handleCreateInline = () => {
    const pro = parseFloat(foodForm.protein);
    const carb = parseFloat(foodForm.carbs);
    const fat = parseFloat(foodForm.fat);

    if (!foodForm.name.trim() || [pro, carb, fat].some((v) => isNaN(v) || v < 0)) {
      toast({ title: "Erro", description: "Preencha todos os campos corretamente.", variant: "destructive" });
      return;
    }

    createFood.mutate(
      {
        name: foodForm.name.trim(),
        calories_kcal: computedCalories,
        protein_g: pro,
        carbs_g: carb,
        fat_g: fat,
        brand: foodForm.brand.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          toast({ title: "Alimento criado!", description: `${result.name} adicionado.` });
          setSelectedFood(result);
          setShowCreateForm(false);
          setFoodForm(emptyFoodForm);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível criar o alimento.", variant: "destructive" });
        },
      }
    );
  };

  const handleAdd = () => {
    if (!selectedFood || !grams) return;
    addItem.mutate(
      {
        mealId,
        item: {
          food_item_id: selectedFood.id,
          quantity_grams: parseFloat(grams),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Alimento adicionado!",
            description: `${selectedFood.name} (${grams}g) foi adicionado à refeição.`,
          });
          setSelectedFood(null);
          setGrams("");
          setSearch("");
          onOpenChange(false);
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível adicionar o alimento.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Alimento</DialogTitle>
          <DialogDescription>
            Busque um alimento e defina a quantidade em gramas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          {!showCreateForm && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar alimento..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedFood(null);
                }}
                className="pl-10"
              />
            </div>
          )}

          {/* Inline create food form */}
          {showCreateForm && !selectedFood && (
            <div className="rounded-xl border p-3 space-y-3">
              <p className="text-sm font-medium">Criar Novo Alimento (valores por 100g)</p>
              <div className="space-y-2">
                <Input placeholder="Nome" value={foodForm.name} onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })} />
                <Input placeholder="Marca (opcional)" value={foodForm.brand} onChange={(e) => setFoodForm({ ...foodForm, brand: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" min="0" step="0.1" placeholder="Proteína (g)" value={foodForm.protein} onChange={(e) => setFoodForm({ ...foodForm, protein: e.target.value })} />
                <Input type="number" min="0" step="0.1" placeholder="Carboidratos (g)" value={foodForm.carbs} onChange={(e) => setFoodForm({ ...foodForm, carbs: e.target.value })} />
                <Input type="number" min="0" step="0.1" placeholder="Gordura (g)" value={foodForm.fat} onChange={(e) => setFoodForm({ ...foodForm, fat: e.target.value })} />
                <div className="flex items-center">
                  <div className="w-full rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    {computedCalories > 0 ? `${computedCalories} kcal` : "Calorias (auto)"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateInline} className="flex-1" disabled={createFood.isPending}>
                  {createFood.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Criar
                </Button>
                <Button variant="outline" onClick={() => { setShowCreateForm(false); setFoodForm(emptyFoodForm); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Results */}
          {!selectedFood && !showCreateForm && (
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border p-2">
              {isLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {foods?.length === 0 && !isLoading && (
                <div className="text-center py-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Nenhum alimento encontrado.</p>
                  <Button variant="outline" size="sm" onClick={() => { setShowCreateForm(true); setFoodForm({ ...emptyFoodForm, name: search }); }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Criar Alimento
                  </Button>
                </div>
              )}
              {foods?.map((food) => (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => setSelectedFood(food)}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <div className="font-medium">{food.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {food.calories_kcal} kcal · P: {food.protein_g}g · C: {food.carbs_g}g · G:{" "}
                    {food.fat_g}g (por 100g)
                  </div>
                </button>
              ))}
              {foods && foods.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors text-primary"
                >
                  <Plus className="h-3 w-3 inline mr-1" />
                  Criar novo alimento manualmente
                </button>
              )}
            </div>
          )}

          {/* Selected food */}
          {selectedFood && (
            <div className="rounded-xl border p-3 bg-accent/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{selectedFood.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedFood.calories_kcal} kcal/100g
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFood(null)}
                >
                  Trocar
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                <Label htmlFor="grams">Quantidade (gramas)</Label>
                <Input
                  id="grams"
                  type="number"
                  min="1"
                  placeholder="Ex: 150"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                />
                {grams && parseFloat(grams) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ≈{" "}
                    {((selectedFood.calories_kcal * parseFloat(grams)) / 100).toFixed(0)}{" "}
                    kcal · P:{" "}
                    {((selectedFood.protein_g * parseFloat(grams)) / 100).toFixed(1)}g · C:{" "}
                    {((selectedFood.carbs_g * parseFloat(grams)) / 100).toFixed(1)}g · G:{" "}
                    {((selectedFood.fat_g * parseFloat(grams)) / 100).toFixed(1)}g
                  </p>
                )}
              </div>

              <Button
                className="w-full mt-3"
                onClick={handleAdd}
                disabled={!grams || parseFloat(grams) <= 0 || addItem.isPending}
              >
                {addItem.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Adicionar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
