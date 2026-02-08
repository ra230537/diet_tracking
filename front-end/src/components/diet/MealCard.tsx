import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Loader2, MoreVertical, Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddFoodModal } from "./AddFoodModal";
import { useRemoveMealItem, useRenameMeal, useDeleteMeal } from "@/hooks/use-diet";
import { toast } from "@/hooks/use-toast";
import type { MealResponse } from "@/lib/types";

interface MealCardProps {
  meal: MealResponse;
  draftChanges: Record<number, number>;
  onQuantityChange: (itemId: number, newQty: number) => void;
}

export function MealCard({ meal, draftChanges, onQuantityChange }: MealCardProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(meal.name);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const removeItem = useRemoveMealItem();
  const renameMeal = useRenameMeal();
  const deleteMeal = useDeleteMeal();

  // Focus the input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleRemove = (itemId: number, name: string) => {
    removeItem.mutate(itemId, {
      onSuccess: () => {
        toast({ title: "Removido", description: `${name} foi removido da refeição.` });
      },
    });
  };

  const handleStartRename = () => {
    setRenameValue(meal.name);
    setIsRenaming(true);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenameValue(meal.name);
  };

  const handleConfirmRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === meal.name) {
      handleCancelRename();
      return;
    }

    renameMeal.mutate(
      { mealId: meal.id, name: trimmed },
      {
        onSuccess: () => {
          toast({ title: "Renomeado", description: `Refeição renomeada para "${trimmed}".` });
          setIsRenaming(false);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível renomear a refeição.", variant: "destructive" });
        },
      }
    );
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmRename();
    } else if (e.key === "Escape") {
      handleCancelRename();
    }
  };

  const handleDeleteMeal = () => {
    deleteMeal.mutate(meal.id, {
      onSuccess: () => {
        toast({ title: "Excluído", description: `Refeição "${meal.name}" foi excluída.` });
        setDeleteDialogOpen(false);
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível excluir a refeição.", variant: "destructive" });
      },
    });
  };

  // Calculate meal totals considering draft changes
  const mealTotals = meal.items.reduce(
    (acc, item) => {
      const draftQty = draftChanges[item.id];
      const ratio = draftQty != null && item.quantity_grams > 0
        ? draftQty / item.quantity_grams
        : 1;
      return {
        calories: acc.calories + item.calculated_calories * ratio,
        protein: acc.protein + item.calculated_protein * ratio,
        carbs: acc.carbs + item.calculated_carbs * ratio,
        fat: acc.fat + item.calculated_fat * ratio,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <>
      <Card className="overflow-hidden">
        {/* Meal Header */}
        <CardHeader className="bg-accent/50 border-b flex flex-row items-center justify-between pb-3">
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  className="h-8 text-sm font-semibold max-w-[220px]"
                  maxLength={255}
                  disabled={renameMeal.isPending}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                  onClick={handleConfirmRename}
                  disabled={renameMeal.isPending}
                >
                  {renameMeal.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={handleCancelRename}
                  disabled={renameMeal.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <CardTitle className="text-base font-semibold">{meal.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(mealTotals.calories)} kcal · P: {mealTotals.protein.toFixed(1)}g · C:{" "}
                  {mealTotals.carbs.toFixed(1)}g · G: {mealTotals.fat.toFixed(1)}g
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Opções da refeição</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleStartRename}>
                  <Pencil className="h-4 w-4" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir refeição
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        {/* Food Items */}
        <CardContent className="p-0">
          {meal.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum alimento nesta refeição.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Alimento</TableHead>
                  <TableHead className="w-[110px] text-center">Qtd (g)</TableHead>
                  <TableHead className="text-right">Calorias</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">P</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">C</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">G</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meal.items.map((item) => {
                  const draftQty = draftChanges[item.id];
                  const currentQty = draftQty ?? item.quantity_grams;
                  const ratio = item.quantity_grams > 0 ? currentQty / item.quantity_grams : 0;
                  const isDraft = draftQty != null;

                  return (
                    <TableRow key={item.id} className={isDraft ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium text-sm max-w-[180px] truncate">
                        {item.food_item_name}
                      </TableCell>
                      <TableCell className="text-center p-1">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={currentQty}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              onQuantityChange(item.id, val);
                            }
                          }}
                          className={`h-8 text-sm text-center w-[90px] mx-auto tabular-nums ${isDraft ? "border-primary" : ""}`}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {Math.round(item.calculated_calories * ratio)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm hidden sm:table-cell">
                        {(item.calculated_protein * ratio).toFixed(1)}g
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm hidden sm:table-cell">
                        {(item.calculated_carbs * ratio).toFixed(1)}g
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm hidden sm:table-cell">
                        {(item.calculated_fat * ratio).toFixed(1)}g
                      </TableCell>
                      <TableCell className="p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(item.id, item.food_item_name)}
                          disabled={removeItem.isPending}
                        >
                          {removeItem.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddFoodModal open={addOpen} onOpenChange={setAddOpen} mealId={meal.id} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir refeição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{meal.name}&quot;? Todos os alimentos desta refeição serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMeal.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMeal}
              disabled={deleteMeal.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMeal.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
