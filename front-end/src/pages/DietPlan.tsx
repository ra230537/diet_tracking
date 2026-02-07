import { useState, useMemo, useCallback } from "react";
import { Utensils, Plus, Loader2, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MacroProgressBar } from "@/components/diet/MacroProgressBar";
import { MealCard } from "@/components/diet/MealCard";
import {
  useCurrentDietPlan,
  useAddMeal,
  useCreateDietPlan,
  useUpdateDietPlanTargets,
  useUpdateMealItem,
} from "@/hooks/use-diet";
import { toast } from "@/hooks/use-toast";
// types used indirectly through hooks

// Draft state: tracks local quantity edits keyed by item ID
type DraftChanges = Record<number, number>; // itemId -> new quantity

export default function DietPlan() {
  const { data: plan, isLoading, isError } = useCurrentDietPlan();
  const addMeal = useAddMeal();
  const createPlan = useCreateDietPlan();
  const updateTargets = useUpdateDietPlanTargets();
  const updateMealItem = useUpdateMealItem();

  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [newMealName, setNewMealName] = useState("");
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [newPlan, setNewPlan] = useState({ calories: "", protein: "", carbs: "", fat: "" });

  // Edit Targets state
  const [editTargetsOpen, setEditTargetsOpen] = useState(false);
  const [editTargets, setEditTargets] = useState({ calories: "", protein: "", carbs: "", fat: "" });

  // Draft mode state
  const [draftChanges, setDraftChanges] = useState<DraftChanges>({});
  const [isSaving, setIsSaving] = useState(false);

  const hasDraftChanges = Object.keys(draftChanges).length > 0;

  // Handle local quantity change
  const handleQuantityChange = useCallback((itemId: number, newQty: number) => {
    setDraftChanges((prev) => {
      const updated = { ...prev };
      // Find original quantity from plan
      if (plan) {
        for (const meal of plan.meals) {
          const item = meal.items.find((i) => i.id === itemId);
          if (item) {
            if (item.quantity_grams === newQty) {
              delete updated[itemId]; // Revert to original
            } else {
              updated[itemId] = newQty;
            }
            break;
          }
        }
      }
      return updated;
    });
  }, [plan]);

  // Calculate totals from current state (including drafts)
  const draftTotals = useMemo(() => {
    if (!plan) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

    let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;

    for (const meal of plan.meals) {
      for (const item of meal.items) {
        const qty = draftChanges[item.id] ?? item.quantity_grams;
        // Recalculate from per-100g values
        // item.calculated_X / item.quantity_grams * 100 = per_100g value
        const ratio = item.quantity_grams > 0 ? qty / item.quantity_grams : 0;
        totalCal += item.calculated_calories * ratio;
        totalPro += item.calculated_protein * ratio;
        totalCarb += item.calculated_carbs * ratio;
        totalFat += item.calculated_fat * ratio;
      }
    }

    return {
      calories: Math.round(totalCal * 100) / 100,
      protein: Math.round(totalPro * 100) / 100,
      carbs: Math.round(totalCarb * 100) / 100,
      fat: Math.round(totalFat * 100) / 100,
    };
  }, [plan, draftChanges]);

  // Save all draft changes
  const handleSaveDraft = async () => {
    if (!hasDraftChanges) return;
    setIsSaving(true);

    try {
      const promises = Object.entries(draftChanges).map(([itemId, qty]) =>
        updateMealItem.mutateAsync({ itemId: parseInt(itemId), quantity_grams: qty })
      );
      await Promise.all(promises);
      toast({ title: "Salvo!", description: "Quantidades atualizadas com sucesso." });
      setDraftChanges({});
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Discard draft
  const handleDiscardDraft = () => {
    setDraftChanges({});
  };

  const handleAddMeal = () => {
    if (!plan || !newMealName.trim()) return;
    const nextOrder = plan.meals.length;
    addMeal.mutate(
      { planId: plan.id, meal: { name: newMealName.trim(), order_index: nextOrder } },
      {
        onSuccess: () => {
          toast({ title: "Refeição adicionada!", description: `${newMealName} foi criada.` });
          setNewMealName("");
          setMealDialogOpen(false);
        },
      }
    );
  };

  const handleCreatePlan = () => {
    createPlan.mutate(
      {
        user_id: "default_user",
        target_calories: parseFloat(newPlan.calories) || 0,
        target_protein: parseFloat(newPlan.protein) || 0,
        target_carbs: parseFloat(newPlan.carbs) || 0,
        target_fat: parseFloat(newPlan.fat) || 0,
        is_active: true,
      },
      {
        onSuccess: () => {
          toast({ title: "Plano criado!", description: "Seu novo plano alimentar está ativo." });
          setCreatePlanOpen(false);
          setNewPlan({ calories: "", protein: "", carbs: "", fat: "" });
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível criar o plano.", variant: "destructive" });
        },
      }
    );
  };

  const openEditTargets = () => {
    if (!plan) return;
    setEditTargets({
      calories: String(plan.target_calories),
      protein: String(plan.target_protein),
      carbs: String(plan.target_carbs),
      fat: String(plan.target_fat),
    });
    setEditTargetsOpen(true);
  };

  const handleSaveTargets = () => {
    if (!plan) return;
    updateTargets.mutate(
      {
        planId: plan.id,
        targets: {
          target_calories: parseFloat(editTargets.calories) || 0,
          target_protein: parseFloat(editTargets.protein) || 0,
          target_carbs: parseFloat(editTargets.carbs) || 0,
          target_fat: parseFloat(editTargets.fat) || 0,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Metas atualizadas!", description: "As metas do plano foram salvas." });
          setEditTargetsOpen(false);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível atualizar as metas.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Carregando plano alimentar...</div>
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Utensils className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Plano Alimentar</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Nenhum plano alimentar ativo encontrado.</p>
            <Button onClick={() => setCreatePlanOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Plano
            </Button>
          </CardContent>
        </Card>

        <Dialog open={createPlanOpen} onOpenChange={setCreatePlanOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Plano Alimentar</DialogTitle>
              <DialogDescription>Defina as metas diárias de macronutrientes.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Calorias (kcal)</Label>
                  <Input type="number" value={newPlan.calories} onChange={(e) => setNewPlan({ ...newPlan, calories: e.target.value })} placeholder="2500" />
                </div>
                <div className="space-y-2">
                  <Label>Proteína (g)</Label>
                  <Input type="number" value={newPlan.protein} onChange={(e) => setNewPlan({ ...newPlan, protein: e.target.value })} placeholder="180" />
                </div>
                <div className="space-y-2">
                  <Label>Carboidratos (g)</Label>
                  <Input type="number" value={newPlan.carbs} onChange={(e) => setNewPlan({ ...newPlan, carbs: e.target.value })} placeholder="300" />
                </div>
                <div className="space-y-2">
                  <Label>Gordura (g)</Label>
                  <Input type="number" value={newPlan.fat} onChange={(e) => setNewPlan({ ...newPlan, fat: e.target.value })} placeholder="80" />
                </div>
              </div>
              <Button onClick={handleCreatePlan} className="w-full" disabled={createPlan.isPending}>
                {createPlan.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Plano
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const sortedMeals = [...plan.meals].sort((a, b) => a.order_index - b.order_index);

  // Use draft totals if there are changes, otherwise use plan totals
  const displayTotals = hasDraftChanges ? draftTotals : {
    calories: plan.total_calories,
    protein: plan.total_protein,
    carbs: plan.total_carbs,
    fat: plan.total_fat,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Utensils className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Plano Alimentar</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMealDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Refeição
        </Button>
      </div>

      {/* Macro targets - with Edit Targets button */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Metas do Dia</CardTitle>
          <Button variant="ghost" size="sm" onClick={openEditTargets}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Editar Metas
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <MacroProgressBar
            label="Calorias"
            actual={displayTotals.calories}
            target={plan.target_calories}
            unit="kcal"
            colorClass="bg-orange-500"
          />
          <MacroProgressBar
            label="Proteína"
            actual={displayTotals.protein}
            target={plan.target_protein}
            unit="g"
            colorClass="bg-red-500"
          />
          <MacroProgressBar
            label="Carboidratos"
            actual={displayTotals.carbs}
            target={plan.target_carbs}
            unit="g"
            colorClass="bg-blue-500"
          />
          <MacroProgressBar
            label="Gordura"
            actual={displayTotals.fat}
            target={plan.target_fat}
            unit="g"
            colorClass="bg-yellow-500"
          />
        </CardContent>
      </Card>

      {/* Draft mode save bar */}
      {hasDraftChanges && (
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border bg-card p-3 shadow-lg border-primary/50">
          <p className="text-sm font-medium text-primary">
            Você tem alterações não salvas
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscardDraft}>
              Descartar
            </Button>
            <Button size="sm" onClick={handleSaveDraft} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar Alterações
            </Button>
          </div>
        </div>
      )}

      {/* Meals with improved hierarchy */}
      <div className="space-y-4">
        {sortedMeals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            draftChanges={draftChanges}
            onQuantityChange={handleQuantityChange}
          />
        ))}
      </div>

      {/* Add meal dialog */}
      <Dialog open={mealDialogOpen} onOpenChange={setMealDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Refeição</DialogTitle>
            <DialogDescription>Adicione uma nova refeição ao plano.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Refeição</Label>
              <Input
                placeholder="Ex: Café da Manhã, Almoço, Lanche..."
                value={newMealName}
                onChange={(e) => setNewMealName(e.target.value)}
              />
            </div>
            <Button onClick={handleAddMeal} className="w-full" disabled={addMeal.isPending || !newMealName.trim()}>
              {addMeal.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Refeição
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Targets dialog */}
      <Dialog open={editTargetsOpen} onOpenChange={setEditTargetsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Metas</DialogTitle>
            <DialogDescription>Atualize as metas diárias de macronutrientes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Calorias (kcal)</Label>
                <Input
                  type="number"
                  value={editTargets.calories}
                  onChange={(e) => setEditTargets({ ...editTargets, calories: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Proteína (g)</Label>
                <Input
                  type="number"
                  value={editTargets.protein}
                  onChange={(e) => setEditTargets({ ...editTargets, protein: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Carboidratos (g)</Label>
                <Input
                  type="number"
                  value={editTargets.carbs}
                  onChange={(e) => setEditTargets({ ...editTargets, carbs: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Gordura (g)</Label>
                <Input
                  type="number"
                  value={editTargets.fat}
                  onChange={(e) => setEditTargets({ ...editTargets, fat: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleSaveTargets} className="w-full" disabled={updateTargets.isPending}>
              {updateTargets.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Metas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
