import { useState } from "react";
import { Dumbbell, Loader2, Save, Pencil, Trash2, History } from "lucide-react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCreateBodyLog, useBodyLogs, useUpdateBodyLog, useDeleteBodyLog } from "@/hooks/use-body-logs";
import { useCheckStagnation, useApplySuggestion } from "@/hooks/use-coach";
import { toast } from "@/hooks/use-toast";
import type { BodyLogResponse, StagnationResult } from "@/lib/types";

interface BodyLogFormData {
  date: string;
  weight_kg: string;
  skinfold_chest: string;
  skinfold_abdomen: string;
  skinfold_thigh: string;
  skinfold_triceps: string;
  skinfold_subscapular: string;
  skinfold_suprailiac: string;
  skinfold_midaxillary: string;
  bio_body_fat_percent: string;
  bio_muscle_mass_kg: string;
  circ_neck: string;
  circ_chest: string;
  circ_waist: string;
  circ_abdomen: string;
  circ_hip: string;
  circ_right_arm: string;
  circ_left_arm: string;
  circ_right_forearm: string;
  circ_left_forearm: string;
  circ_right_thigh: string;
  circ_left_thigh: string;
  circ_right_calf: string;
  circ_left_calf: string;
}

function toNum(v: string): number | null {
  if (!v || v.trim() === "") return null;
  const n = parseFloat(v);
  return isNaN(n) || n <= 0 ? null : n;
}

function FormField({
  label,
  id,
  register,
  error,
  placeholder,
  unit = "mm",
}: {
  label: string;
  id: keyof BodyLogFormData;
  register: ReturnType<typeof useForm<BodyLogFormData>>["register"];
  error?: string;
  placeholder?: string;
  unit?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label} ({unit})
      </Label>
      <Input
        id={id}
        type="number"
        step="0.1"
        min="0"
        placeholder={placeholder || "0"}
        {...register(id)}
        className="h-8 text-sm"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function BodyLog() {
  const createLog = useCreateBodyLog();
  const updateLog = useUpdateBodyLog();
  const deleteLog = useDeleteBodyLog();
  const checkStagnation = useCheckStagnation();
  const applySuggestion = useApplySuggestion();
  const { data: logs, isLoading: logsLoading } = useBodyLogs("default_user", undefined, undefined, 0, 100);
  const today = new Date().toISOString().split("T")[0];

  const [editingLog, setEditingLog] = useState<BodyLogResponse | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editBf, setEditBf] = useState("");
  const [editMuscleMass, setEditMuscleMass] = useState("");
  const [editSkinfoldChest, setEditSkinfoldChest] = useState("");
  const [editSkinfoldAbdomen, setEditSkinfoldAbdomen] = useState("");
  const [editSkinfoldThigh, setEditSkinfoldThigh] = useState("");
  const [editSkinfoldTriceps, setEditSkinfoldTriceps] = useState("");
  const [editSkinfoldSubscapular, setEditSkinfoldSubscapular] = useState("");
  const [editSkinfoldSuprailiac, setEditSkinfoldSuprailiac] = useState("");
  const [editSkinfoldMidaxillary, setEditSkinfoldMidaxillary] = useState("");
  const [editCircNeck, setEditCircNeck] = useState("");
  const [editCircChest, setEditCircChest] = useState("");
  const [editCircWaist, setEditCircWaist] = useState("");
  const [editCircAbdomen, setEditCircAbdomen] = useState("");
  const [editCircHip, setEditCircHip] = useState("");
  const [editCircRightArm, setEditCircRightArm] = useState("");
  const [editCircLeftArm, setEditCircLeftArm] = useState("");
  const [editCircRightForearm, setEditCircRightForearm] = useState("");
  const [editCircLeftForearm, setEditCircLeftForearm] = useState("");
  const [editCircRightThigh, setEditCircRightThigh] = useState("");
  const [editCircLeftThigh, setEditCircLeftThigh] = useState("");
  const [editCircRightCalf, setEditCircRightCalf] = useState("");
  const [editCircLeftCalf, setEditCircLeftCalf] = useState("");

  // Coach dialog state
  const [coachDialogOpen, setCoachDialogOpen] = useState(false);
  const [stagnationData, setStagnationData] = useState<StagnationResult | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BodyLogFormData>({
    defaultValues: {
      date: today,
      weight_kg: "",
      skinfold_chest: "", skinfold_abdomen: "", skinfold_thigh: "",
      skinfold_triceps: "", skinfold_subscapular: "", skinfold_suprailiac: "",
      skinfold_midaxillary: "", bio_body_fat_percent: "", bio_muscle_mass_kg: "",
      circ_neck: "", circ_chest: "", circ_waist: "", circ_abdomen: "",
      circ_hip: "", circ_right_arm: "", circ_left_arm: "",
      circ_right_forearm: "", circ_left_forearm: "",
      circ_right_thigh: "", circ_left_thigh: "",
      circ_right_calf: "", circ_left_calf: "",
    },
  });

  const onSubmit = (data: BodyLogFormData) => {
    const weightNum = parseFloat(data.weight_kg);
    if (!data.date || isNaN(weightNum) || weightNum <= 0) {
      toast({ title: "Erro", description: "Data e peso são obrigatórios.", variant: "destructive" });
      return;
    }

    const payload = {
      date: data.date,
      user_id: "default_user",
      weight_kg: weightNum,
      skinfold_chest: toNum(data.skinfold_chest),
      skinfold_abdomen: toNum(data.skinfold_abdomen),
      skinfold_thigh: toNum(data.skinfold_thigh),
      skinfold_triceps: toNum(data.skinfold_triceps),
      skinfold_subscapular: toNum(data.skinfold_subscapular),
      skinfold_suprailiac: toNum(data.skinfold_suprailiac),
      skinfold_midaxillary: toNum(data.skinfold_midaxillary),
      bio_body_fat_percent: toNum(data.bio_body_fat_percent),
      bio_muscle_mass_kg: toNum(data.bio_muscle_mass_kg),
      circ_neck: toNum(data.circ_neck),
      circ_chest: toNum(data.circ_chest),
      circ_waist: toNum(data.circ_waist),
      circ_abdomen: toNum(data.circ_abdomen),
      circ_hip: toNum(data.circ_hip),
      circ_right_arm: toNum(data.circ_right_arm),
      circ_left_arm: toNum(data.circ_left_arm),
      circ_right_forearm: toNum(data.circ_right_forearm),
      circ_left_forearm: toNum(data.circ_left_forearm),
      circ_right_thigh: toNum(data.circ_right_thigh),
      circ_left_thigh: toNum(data.circ_left_thigh),
      circ_right_calf: toNum(data.circ_right_calf),
      circ_left_calf: toNum(data.circ_left_calf),
    };

    createLog.mutate(payload, {
      onSuccess: (result) => {
        const bfMsg = result.calculated_body_fat_percent
          ? ` | BF% calculado: ${result.calculated_body_fat_percent.toFixed(1)}%`
          : "";
        toast({
          title: "Registro salvo!",
          description: `Peso: ${result.weight_kg} kg${bfMsg}`,
        });
        reset({ date: today });

        // Task 5: Trigger stagnation check after successful log
        checkStagnation.mutate(
          { user_id: "default_user" },
          {
            onSuccess: (stagnation) => {
              if (stagnation.is_stagnating) {
                setStagnationData(stagnation);
                setCoachDialogOpen(true);
              }
              // If not stagnating, the toast above is enough
            },
            // If error (not enough data), silently ignore
          }
        );
      },
      onError: () => {
        toast({
          title: "Erro",
          description: "Não foi possível salvar o registro.",
          variant: "destructive",
        });
      },
    });
  };

  const numToStr = (v: number | null | undefined): string => v != null ? String(v) : "";

  const handleEditOpen = (log: BodyLogResponse) => {
    setEditingLog(log);
    setEditDate(log.date);
    setEditWeight(String(log.weight_kg));
    setEditBf(numToStr(log.bio_body_fat_percent));
    setEditMuscleMass(numToStr(log.bio_muscle_mass_kg));
    setEditSkinfoldChest(numToStr(log.skinfold_chest));
    setEditSkinfoldAbdomen(numToStr(log.skinfold_abdomen));
    setEditSkinfoldThigh(numToStr(log.skinfold_thigh));
    setEditSkinfoldTriceps(numToStr(log.skinfold_triceps));
    setEditSkinfoldSubscapular(numToStr(log.skinfold_subscapular));
    setEditSkinfoldSuprailiac(numToStr(log.skinfold_suprailiac));
    setEditSkinfoldMidaxillary(numToStr(log.skinfold_midaxillary));
    setEditCircNeck(numToStr(log.circ_neck));
    setEditCircChest(numToStr(log.circ_chest));
    setEditCircWaist(numToStr(log.circ_waist));
    setEditCircAbdomen(numToStr(log.circ_abdomen));
    setEditCircHip(numToStr(log.circ_hip));
    setEditCircRightArm(numToStr(log.circ_right_arm));
    setEditCircLeftArm(numToStr(log.circ_left_arm));
    setEditCircRightForearm(numToStr(log.circ_right_forearm));
    setEditCircLeftForearm(numToStr(log.circ_left_forearm));
    setEditCircRightThigh(numToStr(log.circ_right_thigh));
    setEditCircLeftThigh(numToStr(log.circ_left_thigh));
    setEditCircRightCalf(numToStr(log.circ_right_calf));
    setEditCircLeftCalf(numToStr(log.circ_left_calf));
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!editingLog) return;
    const w = parseFloat(editWeight);
    if (isNaN(w) || w <= 0) {
      toast({ title: "Erro", description: "Peso inválido.", variant: "destructive" });
      return;
    }

    updateLog.mutate(
      {
        id: editingLog.id,
        data: {
          date: editDate,
          weight_kg: w,
          bio_body_fat_percent: toNum(editBf),
          bio_muscle_mass_kg: toNum(editMuscleMass),
          skinfold_chest: toNum(editSkinfoldChest),
          skinfold_abdomen: toNum(editSkinfoldAbdomen),
          skinfold_thigh: toNum(editSkinfoldThigh),
          skinfold_triceps: toNum(editSkinfoldTriceps),
          skinfold_subscapular: toNum(editSkinfoldSubscapular),
          skinfold_suprailiac: toNum(editSkinfoldSuprailiac),
          skinfold_midaxillary: toNum(editSkinfoldMidaxillary),
          circ_neck: toNum(editCircNeck),
          circ_chest: toNum(editCircChest),
          circ_waist: toNum(editCircWaist),
          circ_abdomen: toNum(editCircAbdomen),
          circ_hip: toNum(editCircHip),
          circ_right_arm: toNum(editCircRightArm),
          circ_left_arm: toNum(editCircLeftArm),
          circ_right_forearm: toNum(editCircRightForearm),
          circ_left_forearm: toNum(editCircLeftForearm),
          circ_right_thigh: toNum(editCircRightThigh),
          circ_left_thigh: toNum(editCircLeftThigh),
          circ_right_calf: toNum(editCircRightCalf),
          circ_left_calf: toNum(editCircLeftCalf),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Atualizado!", description: "Registro corporal atualizado." });
          setEditOpen(false);
          setEditingLog(null);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (log: BodyLogResponse) => {
    deleteLog.mutate(log.id, {
      onSuccess: () => {
        toast({ title: "Excluído!", description: `Registro de ${log.date} removido.` });
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
      },
    });
  };

  const handleApplyCoachSuggestion = () => {
    if (!stagnationData) return;
    applySuggestion.mutate(
      {
        user_id: "default_user",
        calorie_adjustment: stagnationData.suggested_calorie_adjustment ?? 0,
        carb_adjustment_g: stagnationData.suggested_carb_adjustment_g ?? 0,
        w_curr: stagnationData.current_week_avg_weight,
        w_prev: stagnationData.previous_week_avg_weight,
      },
      {
        onSuccess: () => {
          toast({ title: "Sugestão aplicada!", description: "As metas foram atualizadas." });
          setCoachDialogOpen(false);
          setStagnationData(null);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível aplicar a sugestão.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Dumbbell className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Registro Corporal</h1>
      </div>

      <Tabs defaultValue="form">
        <TabsList>
          <TabsTrigger value="form">Novo Registro</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1">
            <History className="h-3.5 w-3.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* New Log Form Tab */}
        <TabsContent value="form">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Principais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data</Label>
                    <Input id="date" type="date" {...register("date")} />
                    {errors.date && (
                      <p className="text-xs text-red-400">{errors.date.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight_kg">Peso (kg)</Label>
                    <Input
                      id="weight_kg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Ex: 82.5"
                      {...register("weight_kg")}
                    />
                    {errors.weight_kg && (
                      <p className="text-xs text-red-400">{errors.weight_kg.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Accordion type="multiple" className="mt-4">
              {/* Skinfolds */}
              <AccordionItem value="skinfolds">
                <Card>
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <CardTitle className="text-base text-left">
                      Dobras Cutâneas (7 Pollock)
                    </CardTitle>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
                      <FormField label="Peitoral" id="skinfold_chest" register={register} error={errors.skinfold_chest?.message} />
                      <FormField label="Abdômen" id="skinfold_abdomen" register={register} error={errors.skinfold_abdomen?.message} />
                      <FormField label="Coxa" id="skinfold_thigh" register={register} error={errors.skinfold_thigh?.message} />
                      <FormField label="Tríceps" id="skinfold_triceps" register={register} error={errors.skinfold_triceps?.message} />
                      <FormField label="Subescapular" id="skinfold_subscapular" register={register} error={errors.skinfold_subscapular?.message} />
                      <FormField label="Suprailíaca" id="skinfold_suprailiac" register={register} error={errors.skinfold_suprailiac?.message} />
                      <FormField label="Axilar Média" id="skinfold_midaxillary" register={register} error={errors.skinfold_midaxillary?.message} />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              {/* Bioimpedance */}
              <AccordionItem value="bioimpedance">
                <Card>
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <CardTitle className="text-base text-left">
                      Bioimpedância (Opcional)
                    </CardTitle>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="grid grid-cols-2 gap-4 pt-2">
                      <FormField label="% Gordura" id="bio_body_fat_percent" register={register} error={errors.bio_body_fat_percent?.message} unit="%" />
                      <FormField label="Massa Muscular" id="bio_muscle_mass_kg" register={register} error={errors.bio_muscle_mass_kg?.message} unit="kg" />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              {/* Circumferences */}
              <AccordionItem value="circumferences">
                <Card>
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <CardTitle className="text-base text-left">
                      Circunferências
                    </CardTitle>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
                      <FormField label="Pescoço" id="circ_neck" register={register} error={errors.circ_neck?.message} unit="cm" />
                      <FormField label="Peitoral" id="circ_chest" register={register} error={errors.circ_chest?.message} unit="cm" />
                      <FormField label="Cintura" id="circ_waist" register={register} error={errors.circ_waist?.message} unit="cm" />
                      <FormField label="Abdômen" id="circ_abdomen" register={register} error={errors.circ_abdomen?.message} unit="cm" />
                      <FormField label="Quadril" id="circ_hip" register={register} error={errors.circ_hip?.message} unit="cm" />
                      <FormField label="Braço Dir." id="circ_right_arm" register={register} error={errors.circ_right_arm?.message} unit="cm" />
                      <FormField label="Braço Esq." id="circ_left_arm" register={register} error={errors.circ_left_arm?.message} unit="cm" />
                      <FormField label="Antebraço Dir." id="circ_right_forearm" register={register} error={errors.circ_right_forearm?.message} unit="cm" />
                      <FormField label="Antebraço Esq." id="circ_left_forearm" register={register} error={errors.circ_left_forearm?.message} unit="cm" />
                      <FormField label="Coxa Dir." id="circ_right_thigh" register={register} error={errors.circ_right_thigh?.message} unit="cm" />
                      <FormField label="Coxa Esq." id="circ_left_thigh" register={register} error={errors.circ_left_thigh?.message} unit="cm" />
                      <FormField label="Panturrilha Dir." id="circ_right_calf" register={register} error={errors.circ_right_calf?.message} unit="cm" />
                      <FormField label="Panturrilha Esq." id="circ_left_calf" register={register} error={errors.circ_left_calf?.message} unit="cm" />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            </Accordion>

            <div className="mt-6">
              <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={createLog.isPending}>
                {createLog.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Registro
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Registros</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !logs || logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum registro encontrado. Comece registrando seu peso.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Peso (kg)</TableHead>
                      <TableHead className="text-right">BF%</TableHead>
                      <TableHead className="text-right w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const bf = log.calculated_body_fat_percent ?? log.bio_body_fat_percent;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">
                            {new Date(log.date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {log.weight_kg.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {bf != null ? `${bf.toFixed(1)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditOpen(log)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(log)}
                                disabled={deleteLog.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
            <DialogDescription>Corrija os dados do registro corporal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Main fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input type="number" step="0.1" min="0" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} />
              </div>
            </div>

            <Accordion type="multiple">
              {/* Bioimpedance */}
              <AccordionItem value="bio">
                <AccordionTrigger className="text-sm font-medium py-2">Bioimpedância</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs">% Gordura</Label>
                      <Input type="number" step="0.1" min="0" max="100" value={editBf} onChange={(e) => setEditBf(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Massa Muscular (kg)</Label>
                      <Input type="number" step="0.1" min="0" value={editMuscleMass} onChange={(e) => setEditMuscleMass(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Skinfolds */}
              <AccordionItem value="skinfolds">
                <AccordionTrigger className="text-sm font-medium py-2">Dobras Cutâneas (mm)</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Peitoral</Label>
                      <Input type="number" step="0.1" min="0" value={editSkinfoldChest} onChange={(e) => setEditSkinfoldChest(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Abdômen</Label>
                      <Input type="number" step="0.1" min="0" value={editSkinfoldAbdomen} onChange={(e) => setEditSkinfoldAbdomen(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Coxa</Label>
                      <Input type="number" step="0.1" min="0" value={editSkinfoldThigh} onChange={(e) => setEditSkinfoldThigh(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tríceps</Label>
                      <Input type="number" step="0.1" min="0" value={editSkinfoldTriceps} onChange={(e) => setEditSkinfoldTriceps(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Subescapular</Label>
                      <Input type="number" step="0.1" min="0" value={editSkinfoldSubscapular} onChange={(e) => setEditSkinfoldSubscapular(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Suprailíaca</Label>
                      <Input type="number" step="0.1" min="0" value={editSkinfoldSuprailiac} onChange={(e) => setEditSkinfoldSuprailiac(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Axilar Média</Label>
                      <Input type="number" step="0.1" min="0" value={editSkinfoldMidaxillary} onChange={(e) => setEditSkinfoldMidaxillary(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Circumferences */}
              <AccordionItem value="circumferences">
                <AccordionTrigger className="text-sm font-medium py-2">Circunferências (cm)</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Pescoço</Label>
                      <Input type="number" step="0.1" min="0" value={editCircNeck} onChange={(e) => setEditCircNeck(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Peitoral</Label>
                      <Input type="number" step="0.1" min="0" value={editCircChest} onChange={(e) => setEditCircChest(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cintura</Label>
                      <Input type="number" step="0.1" min="0" value={editCircWaist} onChange={(e) => setEditCircWaist(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Abdômen</Label>
                      <Input type="number" step="0.1" min="0" value={editCircAbdomen} onChange={(e) => setEditCircAbdomen(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quadril</Label>
                      <Input type="number" step="0.1" min="0" value={editCircHip} onChange={(e) => setEditCircHip(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Braço Dir.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircRightArm} onChange={(e) => setEditCircRightArm(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Braço Esq.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircLeftArm} onChange={(e) => setEditCircLeftArm(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Antebraço Dir.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircRightForearm} onChange={(e) => setEditCircRightForearm(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Antebraço Esq.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircLeftForearm} onChange={(e) => setEditCircLeftForearm(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Coxa Dir.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircRightThigh} onChange={(e) => setEditCircRightThigh(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Coxa Esq.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircLeftThigh} onChange={(e) => setEditCircLeftThigh(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Panturrilha Dir.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircRightCalf} onChange={(e) => setEditCircRightCalf(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Panturrilha Esq.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircLeftCalf} onChange={(e) => setEditCircLeftCalf(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Button onClick={handleEditSave} className="w-full" disabled={updateLog.isPending}>
              {updateLog.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coach Stagnation Dialog (Task 5) */}
      <Dialog open={coachDialogOpen} onOpenChange={setCoachDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={stagnationData?.analysis_state === "high_velocity" ? "text-orange-400" : "text-yellow-500"}>
              {stagnationData?.analysis_state === "high_velocity"
                ? "Ganho Acelerado Detectado!"
                : stagnationData?.analysis_state === "weight_loss"
                  ? "Perda de Peso Detectada!"
                  : "Ajuste Sugerido!"}
            </DialogTitle>
            <DialogDescription>
              {stagnationData?.analysis_state === "high_velocity"
                ? "Você está ganhando peso rápido demais. O Coach sugere reduzir sua ingestão."
                : stagnationData?.analysis_state === "weight_loss"
                  ? "Você está perdendo peso. O Coach sugere aumentar sua ingestão."
                  : "Seu ganho de peso está abaixo da meta. O Coach sugere aumentar sua ingestão."}
            </DialogDescription>
          </DialogHeader>
          {stagnationData && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 bg-accent/30 space-y-2 text-sm">
                <p>{stagnationData.message}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Meta Atual</p>
                    <p className="font-bold">{stagnationData.current_calories != null ? Math.round(stagnationData.current_calories) : "—"} kcal</p>
                    <p className="text-xs">{stagnationData.current_carbs_g != null ? Math.round(stagnationData.current_carbs_g) : "—"}g carbs</p>
                  </div>
                  <div className="rounded-md border p-2 text-center border-yellow-500/50 bg-yellow-950/20">
                    <p className="text-xs text-yellow-400">Nova Meta Sugerida</p>
                    <p className="font-bold text-yellow-300">{stagnationData.suggested_calories != null ? Math.round(stagnationData.suggested_calories) : "—"} kcal</p>
                    <p className="text-xs text-yellow-400">
                      {stagnationData.suggested_carbs_g != null ? Math.round(stagnationData.suggested_carbs_g) : "—"}g carbs
                      {stagnationData.suggested_carb_adjustment_g != null && (
                        <span className="ml-1">
                          ({stagnationData.suggested_carb_adjustment_g >= 0 ? "+" : ""}
                          {stagnationData.suggested_carb_adjustment_g.toFixed(0)}g)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                  onClick={handleApplyCoachSuggestion}
                  disabled={applySuggestion.isPending}
                >
                  {applySuggestion.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Aceitar Ajuste
                </Button>
                <Button variant="outline" onClick={() => { setCoachDialogOpen(false); setStagnationData(null); }}>
                  Dispensar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
