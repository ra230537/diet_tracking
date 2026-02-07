import { useState, useMemo, useCallback } from "react";
import { Utensils, Plus, Loader2, Pencil, AlertTriangle } from "lucide-react";
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
import { useBodyLogs } from "@/hooks/use-body-logs";
import { toast } from "@/hooks/use-toast";

// Draft state: tracks local quantity edits keyed by item ID
type DraftChanges = Record<number, number>; // itemId -> new quantity

export default function DietPlan() {
  const { data: plan, isLoading, isError } = useCurrentDietPlan();
  const addMeal = useAddMeal();
  const createPlan = useCreateDietPlan();
  const updateTargets = useUpdateDietPlanTargets();
  const updateMealItem = useUpdateMealItem();
  const { data: bodyLogs } = useBodyLogs("default_user", undefined, undefined, 0, 1);

  const latestWeight = bodyLogs?.[0]?.weight_kg ?? null;

  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [newMealName, setNewMealName] = useState("");
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [usePerKg, setUsePerKg] = useState(false);
  const [newPlan, setNewPlan] = useState({ protein: "", carbs: "", fat: "" });
  const [newPlanPerKg, setNewPlanPerKg] = useState({ protein: "", carbs: "", fat: "" });

  // Edit Targets state
  const [editTargetsOpen, setEditTargetsOpen] = useState(false);
  const [editUsePerKg, setEditUsePerKg] = useState(false);
  const [editTargets, setEditTargets] = useState({ protein: "", carbs: "", fat: "" });
  const [editTargetsPerKg, setEditTargetsPerKg] = useState({ protein: "", carbs: "", fat: "" });

  // Draft mode state
  const [draftChanges, setDraftChanges] = useState<DraftChanges>({});
  const [isSaving, setIsSaving] = useState(false);

  const hasDraftChanges = Object.keys(draftChanges).length > 0;

  // Auto-calculate calories helper
  const calcCalories = (pro: string, carb: string, fat: string) => {
    const p = parseFloat(pro) || 0;
    const c = parseFloat(carb) || 0;
    const f = parseFloat(fat) || 0;
    return Math.round((p * 4 + c * 4 + f * 9) * 100) / 100;
  };

  // Computed calories for new plan
  const newPlanCalories = useMemo(() => {
    if (usePerKg && latestWeight) {
      const p = (parseFloat(newPlanPerKg.protein) || 0) * latestWeight;
      const c = (parseFloat(newPlanPerKg.carbs) || 0) * latestWeight;
      const f = (parseFloat(newPlanPerKg.fat) || 0) * latestWeight;
      return Math.round((p * 4 + c * 4 + f * 9) * 100) / 100;
    }
    return calcCalories(newPlan.protein, newPlan.carbs, newPlan.fat);
  }, [usePerKg, newPlan, newPlanPerKg, latestWeight]);

  // Computed calories for edit targets
  const editCalories = useMemo(() => {
    if (editUsePerKg && latestWeight) {
      const p = (parseFloat(editTargetsPerKg.protein) || 0) * latestWeight;
      const c = (parseFloat(editTargetsPerKg.carbs) || 0) * latestWeight;
      const f = (parseFloat(editTargetsPerKg.fat) || 0) * latestWeight;
      return Math.round((p * 4 + c * 4 + f * 9) * 100) / 100;
    }
    return calcCalories(editTargets.protein, editTargets.carbs, editTargets.fat);
  }, [editUsePerKg, editTargets, editTargetsPerKg, latestWeight]);

  // Handle local quantity change
  const handleQuantityChange = useCallback((itemId: number, newQty: number) => {
    setDraftChanges((prev) => {
      const updated = { ...prev };
      if (plan) {
        for (const meal of plan.meals) {
          const item = meal.items.find((i) => i.id === itemId);
          if (item) {
            if (item.quantity_grams === newQty) {
              delete updated[itemId];
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

  const resolveAbsoluteValues = (mode: "create" | "edit") => {
    if (mode === "create") {
      if (usePerKg && latestWeight) {
        return {
          protein: Math.round((parseFloat(newPlanPerKg.protein) || 0) * latestWeight * 10) / 10,
          carbs: Math.round((parseFloat(newPlanPerKg.carbs) || 0) * latestWeight * 10) / 10,
          fat: Math.round((parseFloat(newPlanPerKg.fat) || 0) * latestWeight * 10) / 10,
        };
      }
      return {
        protein: parseFloat(newPlan.protein) || 0,
        carbs: parseFloat(newPlan.carbs) || 0,
        fat: parseFloat(newPlan.fat) || 0,
      };
    }
    // edit mode
    if (editUsePerKg && latestWeight) {
      return {
        protein: Math.round((parseFloat(editTargetsPerKg.protein) || 0) * latestWeight * 10) / 10,
        carbs: Math.round((parseFloat(editTargetsPerKg.carbs) || 0) * latestWeight * 10) / 10,
        fat: Math.round((parseFloat(editTargetsPerKg.fat) || 0) * latestWeight * 10) / 10,
      };
    }
    return {
      protein: parseFloat(editTargets.protein) || 0,
      carbs: parseFloat(editTargets.carbs) || 0,
      fat: parseFloat(editTargets.fat) || 0,
    };
  };

  const handleCreatePlan = () => {
    const abs = resolveAbsoluteValues("create");
    const cal = calcCalories(String(abs.protein), String(abs.carbs), String(abs.fat));

    createPlan.mutate(
      {
        user_id: "default_user",
        target_calories: cal,
        target_protein: abs.protein,
        target_carbs: abs.carbs,
        target_fat: abs.fat,
        is_active: true,
      },
      {
        onSuccess: () => {
          toast({ title: "Plano criado!", description: "Seu novo plano alimentar está ativo." });
          setCreatePlanOpen(false);
          setNewPlan({ protein: "", carbs: "", fat: "" });
          setNewPlanPerKg({ protein: "", carbs: "", fat: "" });
          setUsePerKg(false);
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
      protein: String(plan.target_protein),
      carbs: String(plan.target_carbs),
      fat: String(plan.target_fat),
    });
    if (latestWeight && latestWeight > 0) {
      setEditTargetsPerKg({
        protein: (plan.target_protein / latestWeight).toFixed(2),
        carbs: (plan.target_carbs / latestWeight).toFixed(2),
        fat: (plan.target_fat / latestWeight).toFixed(2),
      });
    }
    setEditUsePerKg(false);
    setEditTargetsOpen(true);
  };

  const handleSaveTargets = () => {
    if (!plan) return;
    const abs = resolveAbsoluteValues("edit");
    const cal = calcCalories(String(abs.protein), String(abs.carbs), String(abs.fat));

    updateTargets.mutate(
      {
        planId: plan.id,
        targets: {
          target_calories: cal,
          target_protein: abs.protein,
          target_carbs: abs.carbs,
          target_fat: abs.fat,
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

  // Shared macro form component
  const MacroFormFields = ({
    mode,
    isPerKg,
    setIsPerKg,
    absolute,
    setAbsolute,
    perKg,
    setPerKg,
    computedCal,
  }: {
    mode: string;
    isPerKg: boolean;
    setIsPerKg: (v: boolean) => void;
    absolute: { protein: string; carbs: string; fat: string };
    setAbsolute: (v: { protein: string; carbs: string; fat: string }) => void;
    perKg: { protein: string; carbs: string; fat: string };
    setPerKg: (v: { protein: string; carbs: string; fat: string }) => void;
    computedCal: number;
  }) => (
    <div className="space-y-4">
      {/* Toggle g/kg */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsPerKg(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !isPerKg
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          Gramas totais
        </button>
        <button
          type="button"
          onClick={() => {
            if (!latestWeight) {
              toast({
                title: "Peso não registrado",
                description: "Registre seu peso na seção Body Log antes de usar g/kg.",
                variant: "destructive",
              });
              return;
            }
            setIsPerKg(true);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isPerKg
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          g/kg de peso
        </button>
        {isPerKg && latestWeight && (
          <span className="text-xs text-muted-foreground">
            ({latestWeight.toFixed(1)} kg)
          </span>
        )}
      </div>

      {!latestWeight && isPerKg && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-2.5">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-300">
            Nenhum peso registrado. Por favor, registre seu peso primeiro.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {!isPerKg ? (
          <>
            <div className="space-y-2">
              <Label>Proteína (g)</Label>
              <Input
                type="number"
                value={absolute.protein}
                onChange={(e) => setAbsolute({ ...absolute, protein: e.target.value })}
                placeholder="180"
              />
            </div>
            <div className="space-y-2">
              <Label>Carboidratos (g)</Label>
              <Input
                type="number"
                value={absolute.carbs}
                onChange={(e) => setAbsolute({ ...absolute, carbs: e.target.value })}
                placeholder="300"
              />
            </div>
            <div className="space-y-2">
              <Label>Gordura (g)</Label>
              <Input
                type="number"
                value={absolute.fat}
                onChange={(e) => setAbsolute({ ...absolute, fat: e.target.value })}
                placeholder="80"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Proteína (g/kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={perKg.protein}
                onChange={(e) => setPerKg({ ...perKg, protein: e.target.value })}
                placeholder="2.0"
              />
              {latestWeight && perKg.protein && (
                <p className="text-xs text-muted-foreground">
                  = {((parseFloat(perKg.protein) || 0) * latestWeight).toFixed(0)}g
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Carboidratos (g/kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={perKg.carbs}
                onChange={(e) => setPerKg({ ...perKg, carbs: e.target.value })}
                placeholder="4.0"
              />
              {latestWeight && perKg.carbs && (
                <p className="text-xs text-muted-foreground">
                  = {((parseFloat(perKg.carbs) || 0) * latestWeight).toFixed(0)}g
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Gordura (g/kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={perKg.fat}
                onChange={(e) => setPerKg({ ...perKg, fat: e.target.value })}
                placeholder="1.0"
              />
              {latestWeight && perKg.fat && (
                <p className="text-xs text-muted-foreground">
                  = {((parseFloat(perKg.fat) || 0) * latestWeight).toFixed(0)}g
                </p>
              )}
            </div>
          </>
        )}

        {/* Auto-calculated calories */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Calorias (auto)</Label>
          <div className="flex h-9 w-full items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
            {computedCal > 0 ? `${computedCal} kcal` : "—"}
          </div>
        </div>
      </div>
    </div>
  );

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
              <DialogDescription>
                Defina as metas diárias de macronutrientes. As calorias são calculadas automaticamente.
              </DialogDescription>
            </DialogHeader>
            <MacroFormFields
              mode="create"
              isPerKg={usePerKg}
              setIsPerKg={setUsePerKg}
              absolute={newPlan}
              setAbsolute={setNewPlan}
              perKg={newPlanPerKg}
              setPerKg={setNewPlanPerKg}
              computedCal={newPlanCalories}
            />
            <Button onClick={handleCreatePlan} className="w-full" disabled={createPlan.isPending}>
              {createPlan.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Plano
            </Button>
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
    <div className="space-y-6 pb-20">
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

      {/* Meals */}
      <div className="space-y-5">
        {sortedMeals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            draftChanges={draftChanges}
            onQuantityChange={handleQuantityChange}
          />
        ))}
      </div>

      {/* Floating Action Bar for pending changes */}
      {hasDraftChanges && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-sm px-5 py-3 shadow-2xl">
          <p className="text-sm font-medium text-primary mr-2">
            Alterações pendentes
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscardDraft}
            className="gap-1.5"
          >
            <span>❌</span>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>✅</span>
            )}
            Salvar
          </Button>
        </div>
      )}

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
            <DialogDescription>
              Atualize as metas diárias de macronutrientes. As calorias são calculadas automaticamente.
            </DialogDescription>
          </DialogHeader>
          <MacroFormFields
            mode="edit"
            isPerKg={editUsePerKg}
            setIsPerKg={setEditUsePerKg}
            absolute={editTargets}
            setAbsolute={setEditTargets}
            perKg={editTargetsPerKg}
            setPerKg={setEditTargetsPerKg}
            computedCal={editCalories}
          />
          <Button onClick={handleSaveTargets} className="w-full" disabled={updateTargets.isPending}>
            {updateTargets.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Metas
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
