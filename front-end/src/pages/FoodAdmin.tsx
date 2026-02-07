import { useState, useRef, useMemo } from "react";
import { Database, Upload, Search, Loader2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFoods, useImportTaco, useCreateFood } from "@/hooks/use-foods";
import { toast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

const emptyFoodForm = { name: "", brand: "", protein: "", carbs: "", fat: "" };

export default function FoodAdmin() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [foodForm, setFoodForm] = useState(emptyFoodForm);

  const { data: foods, isLoading } = useFoods(search, page * PAGE_SIZE, PAGE_SIZE);
  const importTaco = useImportTaco();
  const createFood = useCreateFood();

  // Auto-calculate calories from macros
  const computedCalories = useMemo(() => {
    const pro = parseFloat(foodForm.protein) || 0;
    const carb = parseFloat(foodForm.carbs) || 0;
    const fat = parseFloat(foodForm.fat) || 0;
    return Math.round((pro * 4 + carb * 4 + fat * 9) * 100) / 100;
  }, [foodForm.protein, foodForm.carbs, foodForm.fat]);

  const handleCreateFood = () => {
    const pro = parseFloat(foodForm.protein);
    const carb = parseFloat(foodForm.carbs);
    const fat = parseFloat(foodForm.fat);

    if (!foodForm.name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório.", variant: "destructive" });
      return;
    }
    if ([pro, carb, fat].some((v) => isNaN(v) || v < 0)) {
      toast({ title: "Erro", description: "Os valores nutricionais devem ser números positivos.", variant: "destructive" });
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
          toast({ title: "Alimento criado!", description: `${result.name} adicionado ao banco de dados.` });
          setFoodForm(emptyFoodForm);
          setCreateOpen(false);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível criar o alimento.", variant: "destructive" });
        },
      }
    );
  };

  const handleImport = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Selecione um arquivo", description: "Escolha um arquivo CSV para importar.", variant: "destructive" });
      return;
    }

    importTaco.mutate(file, {
      onSuccess: (result) => {
        toast({
          title: "Importação concluída!",
          description: `${result.rows_imported} alimentos importados, ${result.rows_skipped} ignorados de ${result.total_rows_processed} linhas processadas.`,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: (error) => {
        toast({
          title: "Erro na importação",
          description: error.message || "Verifique o formato do arquivo CSV.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Alimentos</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Criar Alimento
        </Button>
      </div>

      {/* CSV Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar Tabela TACO (CSV)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="flex-1 w-full">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formato esperado: Nome, Energia (kcal), Proteína (g), Carboidrato (g), Lipídeos (g)
              </p>
            </div>
            <Button
              onClick={handleImport}
              disabled={importTaco.isPending}
              className="w-full sm:w-auto"
            >
              {importTaco.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Importar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Food list */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Lista de Alimentos</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : foods?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum alimento encontrado. Importe a tabela TACO ou adicione manualmente.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Calorias</TableHead>
                    <TableHead className="text-right">Proteína</TableHead>
                    <TableHead className="text-right">Carbos</TableHead>
                    <TableHead className="text-right">Gordura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {foods?.map((food) => (
                    <TableRow key={food.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {food.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {food.calories_kcal.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {food.protein_g.toFixed(1)}g
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {food.carbs_g.toFixed(1)}g
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {food.fat_g.toFixed(1)}g
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Página {page + 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(foods?.length ?? 0) < PAGE_SIZE}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create food dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Alimento</DialogTitle>
            <DialogDescription>
              Informe os valores nutricionais por 100g. As calorias são calculadas automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Peito de Frango Grelhado"
                value={foodForm.name}
                onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Marca (opcional)</Label>
              <Input
                placeholder="Ex: Sadia"
                value={foodForm.brand}
                onChange={(e) => setFoodForm({ ...foodForm, brand: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proteína (g/100g)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="31"
                  value={foodForm.protein}
                  onChange={(e) => setFoodForm({ ...foodForm, protein: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Carboidratos (g/100g)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={foodForm.carbs}
                  onChange={(e) => setFoodForm({ ...foodForm, carbs: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Gordura (g/100g)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="3.6"
                  value={foodForm.fat}
                  onChange={(e) => setFoodForm({ ...foodForm, fat: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Calorias (auto)</Label>
                <div className="flex h-9 w-full items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                  {computedCalories > 0 ? `${computedCalories} kcal` : "—"}
                </div>
              </div>
            </div>
            <Button onClick={handleCreateFood} className="w-full" disabled={createFood.isPending}>
              {createFood.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Alimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
