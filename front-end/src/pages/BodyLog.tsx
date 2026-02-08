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
import { useCheckStagnation, useApplySuggestion, useDismissSuggestion } from "@/hooks/use-coach";
import { toast } from "@/hooks/use-toast";
import type { BodyLogResponse, StagnationResult } from "@/lib/types";

interface BodyLogFormData {
  date: string;
  weight_kg: string;
  skinfold_chest: string;
  skinfold_abdominal: string;
  skinfold_thigh: string;
  skinfold_triceps: string;
  skinfold_subscapular: string;
  skinfold_suprailiac: string;
  skinfold_axillary: string;
  bio_body_fat_percent: string;
  bio_muscle_mass_kg: string;
  circ_neck: string;
  circ_shoulder: string;
  circ_chest_relaxed: string;
  circ_arm_relaxed_right: string;
  circ_arm_relaxed_left: string;
  circ_arm_contracted_right: string;
  circ_arm_contracted_left: string;
  circ_forearm_right: string;
  circ_forearm_left: string;
  circ_waist: string;
  circ_abdomen: string;
  circ_hips: string;
  circ_thigh_proximal_right: string;
  circ_thigh_proximal_left: string;
  circ_calf_right: string;
  circ_calf_left: string;
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
  const dismissSuggestion = useDismissSuggestion();
  const { data: logs, isLoading: logsLoading } = useBodyLogs("default_user", undefined, undefined, 0, 100);
  const today = new Date().toISOString().split("T")[0];

  const [editingLog, setEditingLog] = useState<BodyLogResponse | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editBf, setEditBf] = useState("");
  const [editMuscleMass, setEditMuscleMass] = useState("");
  const [editSkinfoldChest, setEditSkinfoldChest] = useState("");
  const [editSkinfoldAbdominal, setEditSkinfoldAbdominal] = useState("");
  const [editSkinfoldThigh, setEditSkinfoldThigh] = useState("");
  const [editSkinfoldTriceps, setEditSkinfoldTriceps] = useState("");
  const [editSkinfoldSubscapular, setEditSkinfoldSubscapular] = useState("");
  const [editSkinfoldSuprailiac, setEditSkinfoldSuprailiac] = useState("");
  const [editSkinfoldAxillary, setEditSkinfoldAxillary] = useState("");
  const [editCircNeck, setEditCircNeck] = useState("");
  const [editCircShoulder, setEditCircShoulder] = useState("");
  const [editCircChestRelaxed, setEditCircChestRelaxed] = useState("");
  const [editCircArmRelaxedRight, setEditCircArmRelaxedRight] = useState("");
  const [editCircArmRelaxedLeft, setEditCircArmRelaxedLeft] = useState("");
  const [editCircArmContractedRight, setEditCircArmContractedRight] = useState("");
  const [editCircArmContractedLeft, setEditCircArmContractedLeft] = useState("");
  const [editCircForearmRight, setEditCircForearmRight] = useState("");
  const [editCircForearmLeft, setEditCircForearmLeft] = useState("");
  const [editCircWaist, setEditCircWaist] = useState("");
  const [editCircAbdomen, setEditCircAbdomen] = useState("");
  const [editCircHips, setEditCircHips] = useState("");
  const [editCircThighProximalRight, setEditCircThighProximalRight] = useState("");
  const [editCircThighProximalLeft, setEditCircThighProximalLeft] = useState("");
  const [editCircCalfRight, setEditCircCalfRight] = useState("");
  const [editCircCalfLeft, setEditCircCalfLeft] = useState("");

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
      skinfold_chest: "", skinfold_abdominal: "", skinfold_thigh: "",
      skinfold_triceps: "", skinfold_subscapular: "", skinfold_suprailiac: "",
      skinfold_axillary: "", bio_body_fat_percent: "", bio_muscle_mass_kg: "",
      circ_neck: "", circ_shoulder: "", circ_chest_relaxed: "",
      circ_arm_relaxed_right: "", circ_arm_relaxed_left: "",
      circ_arm_contracted_right: "", circ_arm_contracted_left: "",
      circ_forearm_right: "", circ_forearm_left: "",
      circ_waist: "", circ_abdomen: "",
      circ_hips: "",
      circ_thigh_proximal_right: "", circ_thigh_proximal_left: "",
      circ_calf_right: "", circ_calf_left: "",
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
      skinfold_abdominal: toNum(data.skinfold_abdominal),
      skinfold_thigh: toNum(data.skinfold_thigh),
      skinfold_triceps: toNum(data.skinfold_triceps),
      skinfold_subscapular: toNum(data.skinfold_subscapular),
      skinfold_suprailiac: toNum(data.skinfold_suprailiac),
      skinfold_axillary: toNum(data.skinfold_axillary),
      bio_body_fat_percent: toNum(data.bio_body_fat_percent),
      bio_muscle_mass_kg: toNum(data.bio_muscle_mass_kg),
      circ_neck: toNum(data.circ_neck),
      circ_shoulder: toNum(data.circ_shoulder),
      circ_chest_relaxed: toNum(data.circ_chest_relaxed),
      circ_arm_relaxed_right: toNum(data.circ_arm_relaxed_right),
      circ_arm_relaxed_left: toNum(data.circ_arm_relaxed_left),
      circ_arm_contracted_right: toNum(data.circ_arm_contracted_right),
      circ_arm_contracted_left: toNum(data.circ_arm_contracted_left),
      circ_forearm_right: toNum(data.circ_forearm_right),
      circ_forearm_left: toNum(data.circ_forearm_left),
      circ_waist: toNum(data.circ_waist),
      circ_abdomen: toNum(data.circ_abdomen),
      circ_hips: toNum(data.circ_hips),
      circ_thigh_proximal_right: toNum(data.circ_thigh_proximal_right),
      circ_thigh_proximal_left: toNum(data.circ_thigh_proximal_left),
      circ_calf_right: toNum(data.circ_calf_right),
      circ_calf_left: toNum(data.circ_calf_left),
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
    setEditSkinfoldAbdominal(numToStr(log.skinfold_abdominal));
    setEditSkinfoldThigh(numToStr(log.skinfold_thigh));
    setEditSkinfoldTriceps(numToStr(log.skinfold_triceps));
    setEditSkinfoldSubscapular(numToStr(log.skinfold_subscapular));
    setEditSkinfoldSuprailiac(numToStr(log.skinfold_suprailiac));
    setEditSkinfoldAxillary(numToStr(log.skinfold_axillary));
    setEditCircNeck(numToStr(log.circ_neck));
    setEditCircShoulder(numToStr(log.circ_shoulder));
    setEditCircChestRelaxed(numToStr(log.circ_chest_relaxed));
    setEditCircArmRelaxedRight(numToStr(log.circ_arm_relaxed_right));
    setEditCircArmRelaxedLeft(numToStr(log.circ_arm_relaxed_left));
    setEditCircArmContractedRight(numToStr(log.circ_arm_contracted_right));
    setEditCircArmContractedLeft(numToStr(log.circ_arm_contracted_left));
    setEditCircForearmRight(numToStr(log.circ_forearm_right));
    setEditCircForearmLeft(numToStr(log.circ_forearm_left));
    setEditCircWaist(numToStr(log.circ_waist));
    setEditCircAbdomen(numToStr(log.circ_abdomen));
    setEditCircHips(numToStr(log.circ_hips));
    setEditCircThighProximalRight(numToStr(log.circ_thigh_proximal_right));
    setEditCircThighProximalLeft(numToStr(log.circ_thigh_proximal_left));
    setEditCircCalfRight(numToStr(log.circ_calf_right));
    setEditCircCalfLeft(numToStr(log.circ_calf_left));
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
          skinfold_abdominal: toNum(editSkinfoldAbdominal),
          skinfold_thigh: toNum(editSkinfoldThigh),
          skinfold_triceps: toNum(editSkinfoldTriceps),
          skinfold_subscapular: toNum(editSkinfoldSubscapular),
          skinfold_suprailiac: toNum(editSkinfoldSuprailiac),
          skinfold_axillary: toNum(editSkinfoldAxillary),
          circ_neck: toNum(editCircNeck),
          circ_shoulder: toNum(editCircShoulder),
          circ_chest_relaxed: toNum(editCircChestRelaxed),
          circ_arm_relaxed_right: toNum(editCircArmRelaxedRight),
          circ_arm_relaxed_left: toNum(editCircArmRelaxedLeft),
          circ_arm_contracted_right: toNum(editCircArmContractedRight),
          circ_arm_contracted_left: toNum(editCircArmContractedLeft),
          circ_forearm_right: toNum(editCircForearmRight),
          circ_forearm_left: toNum(editCircForearmLeft),
          circ_waist: toNum(editCircWaist),
          circ_abdomen: toNum(editCircAbdomen),
          circ_hips: toNum(editCircHips),
          circ_thigh_proximal_right: toNum(editCircThighProximalRight),
          circ_thigh_proximal_left: toNum(editCircThighProximalLeft),
          circ_calf_right: toNum(editCircCalfRight),
          circ_calf_left: toNum(editCircCalfLeft),
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
                      <FormField label="Abdômen" id="skinfold_abdominal" register={register} error={errors.skinfold_abdominal?.message} />
                      <FormField label="Coxa" id="skinfold_thigh" register={register} error={errors.skinfold_thigh?.message} />
                      <FormField label="Tríceps" id="skinfold_triceps" register={register} error={errors.skinfold_triceps?.message} />
                      <FormField label="Subescapular" id="skinfold_subscapular" register={register} error={errors.skinfold_subscapular?.message} />
                      <FormField label="Suprailíaca" id="skinfold_suprailiac" register={register} error={errors.skinfold_suprailiac?.message} />
                      <FormField label="Axilar Média" id="skinfold_axillary" register={register} error={errors.skinfold_axillary?.message} />
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
                      <FormField label="Ombro" id="circ_shoulder" register={register} error={errors.circ_shoulder?.message} unit="cm" />
                      <FormField label="Peitoral" id="circ_chest_relaxed" register={register} error={errors.circ_chest_relaxed?.message} unit="cm" />
                      <FormField label="Braço Relaxado Dir." id="circ_arm_relaxed_right" register={register} error={errors.circ_arm_relaxed_right?.message} unit="cm" />
                      <FormField label="Braço Relaxado Esq." id="circ_arm_relaxed_left" register={register} error={errors.circ_arm_relaxed_left?.message} unit="cm" />
                      <FormField label="Braço Contraído Dir." id="circ_arm_contracted_right" register={register} error={errors.circ_arm_contracted_right?.message} unit="cm" />
                      <FormField label="Braço Contraído Esq." id="circ_arm_contracted_left" register={register} error={errors.circ_arm_contracted_left?.message} unit="cm" />
                      <FormField label="Antebraço Dir." id="circ_forearm_right" register={register} error={errors.circ_forearm_right?.message} unit="cm" />
                      <FormField label="Antebraço Esq." id="circ_forearm_left" register={register} error={errors.circ_forearm_left?.message} unit="cm" />
                      <FormField label="Cintura" id="circ_waist" register={register} error={errors.circ_waist?.message} unit="cm" />
                      <FormField label="Abdômen" id="circ_abdomen" register={register} error={errors.circ_abdomen?.message} unit="cm" />
                      <FormField label="Quadril" id="circ_hips" register={register} error={errors.circ_hips?.message} unit="cm" />
                      <FormField label="Coxa Dir." id="circ_thigh_proximal_right" register={register} error={errors.circ_thigh_proximal_right?.message} unit="cm" />
                      <FormField label="Coxa Esq." id="circ_thigh_proximal_left" register={register} error={errors.circ_thigh_proximal_left?.message} unit="cm" />
                      <FormField label="Panturrilha Dir." id="circ_calf_right" register={register} error={errors.circ_calf_right?.message} unit="cm" />
                      <FormField label="Panturrilha Esq." id="circ_calf_left" register={register} error={errors.circ_calf_left?.message} unit="cm" />
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
                      <Input type="number" step="0.1" min="0" value={editSkinfoldAbdominal} onChange={(e) => setEditSkinfoldAbdominal(e.target.value)} placeholder="—" className="h-8 text-sm" />
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
                      <Input type="number" step="0.1" min="0" value={editSkinfoldAxillary} onChange={(e) => setEditSkinfoldAxillary(e.target.value)} placeholder="—" className="h-8 text-sm" />
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
                      <Label className="text-xs">Ombro</Label>
                      <Input type="number" step="0.1" min="0" value={editCircShoulder} onChange={(e) => setEditCircShoulder(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Peitoral</Label>
                      <Input type="number" step="0.1" min="0" value={editCircChestRelaxed} onChange={(e) => setEditCircChestRelaxed(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Braço Relaxado Dir.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircArmRelaxedRight} onChange={(e) => setEditCircArmRelaxedRight(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Braço Relaxado Esq.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircArmRelaxedLeft} onChange={(e) => setEditCircArmRelaxedLeft(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Braço Contraído Dir.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircArmContractedRight} onChange={(e) => setEditCircArmContractedRight(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Braço Contraído Esq.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircArmContractedLeft} onChange={(e) => setEditCircArmContractedLeft(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Antebraço Dir.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircForearmRight} onChange={(e) => setEditCircForearmRight(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Antebraço Esq.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircForearmLeft} onChange={(e) => setEditCircForearmLeft(e.target.value)} placeholder="—" className="h-8 text-sm" />
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
                      <Input type="number" step="0.1" min="0" value={editCircHips} onChange={(e) => setEditCircHips(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Coxa Dir.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircThighProximalRight} onChange={(e) => setEditCircThighProximalRight(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Coxa Esq.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircThighProximalLeft} onChange={(e) => setEditCircThighProximalLeft(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Panturrilha Dir.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircCalfRight} onChange={(e) => setEditCircCalfRight(e.target.value)} placeholder="—" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Panturrilha Esq.</Label>
                      <Input type="number" step="0.1" min="0" value={editCircCalfLeft} onChange={(e) => setEditCircCalfLeft(e.target.value)} placeholder="—" className="h-8 text-sm" />
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
                <Button
                  variant="outline"
                  disabled={dismissSuggestion.isPending}
                  onClick={() => {
                    if (!stagnationData) {
                      setCoachDialogOpen(false);
                      return;
                    }
                    dismissSuggestion.mutate(
                      {
                        user_id: "default_user",
                        w_curr: stagnationData.current_week_avg_weight,
                        w_prev: stagnationData.previous_week_avg_weight,
                      },
                      {
                        onSuccess: () => {
                          setCoachDialogOpen(false);
                          setStagnationData(null);
                        },
                        onError: () => {
                          setCoachDialogOpen(false);
                          setStagnationData(null);
                        },
                      }
                    );
                  }}
                >
                  {dismissSuggestion.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
