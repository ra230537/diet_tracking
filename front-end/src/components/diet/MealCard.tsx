import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
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
import { AddFoodModal } from "./AddFoodModal";
import { useRemoveMealItem } from "@/hooks/use-diet";
import { toast } from "@/hooks/use-toast";
import type { MealResponse } from "@/lib/types";

interface MealCardProps {
  meal: MealResponse;
  draftChanges: Record<number, number>;
  onQuantityChange: (itemId: number, newQty: number) => void;
}

export function MealCard({ meal, draftChanges, onQuantityChange }: MealCardProps) {
  const [addOpen, setAddOpen] = useState(false);
  const removeItem = useRemoveMealItem();

  const handleRemove = (itemId: number, name: string) => {
    removeItem.mutate(itemId, {
      onSuccess: () => {
        toast({ title: "Removido", description: `${name} foi removido da refeição.` });
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
        {/* Meal Header - distinct background for hierarchy */}
        <CardHeader className="bg-accent/50 border-b flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">{meal.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(mealTotals.calories)} kcal · P: {mealTotals.protein.toFixed(1)}g · C:{" "}
              {mealTotals.carbs.toFixed(1)}g · G: {mealTotals.fat.toFixed(1)}g
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </CardHeader>

        {/* Food Items - table layout */}
        <CardContent className="p-0">
          {meal.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
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
    </>
  );
}
