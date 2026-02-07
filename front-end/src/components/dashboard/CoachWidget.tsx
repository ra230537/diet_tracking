import { useEffect } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCheckStagnation, useApplySuggestion } from "@/hooks/use-coach";
import { toast } from "@/hooks/use-toast";

export function CoachWidget() {
  const stagnation = useCheckStagnation();
  const applySuggestion = useApplySuggestion();

  useEffect(() => {
    stagnation.mutate({ user_id: "default_user" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => {
    if (!stagnation.data) return;
    applySuggestion.mutate(
      {
        user_id: "default_user",
        calorie_increase: stagnation.data.suggested_calorie_increase ?? 0,
        carb_increase_g: stagnation.data.suggested_carb_increase_g ?? 0,
      },
      {
        onSuccess: () => {
          toast({
            title: "Sugestão aplicada!",
            description: "As metas de carboidrato e calorias foram atualizadas.",
            variant: "success" as never,
          });
          stagnation.mutate({ user_id: "default_user" });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível aplicar a sugestão.",
            variant: "destructive",
          });
        },
      }
    );
  };

  // If still loading or there's an error (insufficient data, etc.), don't render
  if (stagnation.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Coach Analisando...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (stagnation.isError || !stagnation.data) {
    return null;
  }

  if (!stagnation.data.is_stagnating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            Coach
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{stagnation.data.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Alert variant="warning" className="border-yellow-500/30 bg-yellow-950/20">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="font-semibold">Estagnação Detectada!</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{stagnation.data.message}</p>
        <p className="text-sm">
          Sugestão: aumentar{" "}
          <span className="font-bold text-yellow-300">
            {stagnation.data.suggested_carb_increase_g?.toFixed(0)}g de carboidratos
          </span>{" "}
          (+{stagnation.data.suggested_calorie_increase?.toFixed(0)} kcal)
        </p>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={applySuggestion.isPending}
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          {applySuggestion.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Aceitar Sugestão
        </Button>
      </AlertDescription>
    </Alert>
  );
}
