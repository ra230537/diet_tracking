// ── Food ──
export interface FoodItemCreate {
  name: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  brand?: string;
}

export interface FoodItemResponse {
  id: number;
  name: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  brand: string | null;
  created_at: string;
}

export interface ImportResult {
  message: string;
  total_rows_processed: number;
  rows_imported: number;
  rows_skipped: number;
}

// ── Diet ──
export interface DietPlanCreate {
  user_id: string;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  is_active: boolean;
}

export interface DietPlanResponse {
  id: number;
  user_id: string;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  is_active: boolean;
  created_at: string;
}

export interface MacroComparison {
  target: number;
  actual: number;
  difference: number;
  percentage: number;
}

export interface MealItemResponse {
  id: number;
  food_item_id: number;
  food_item_name: string;
  quantity_grams: number;
  calculated_calories: number;
  calculated_protein: number;
  calculated_carbs: number;
  calculated_fat: number;
}

export interface MealResponse {
  id: number;
  name: string;
  order_index: number;
  items: MealItemResponse[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

export interface DietPlanFullResponse {
  id: number;
  user_id: string;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  is_active: boolean;
  created_at: string;
  meals: MealResponse[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  calories_comparison: MacroComparison;
  protein_comparison: MacroComparison;
  carbs_comparison: MacroComparison;
  fat_comparison: MacroComparison;
}

export interface MealCreate {
  name: string;
  order_index: number;
}

export interface MealItemCreate {
  food_item_id: number;
  quantity_grams: number;
}

// ── Body Log ──
export interface BodyLogCreate {
  date: string;
  user_id: string;
  weight_kg: number;
  bio_body_fat_percent?: number | null;
  bio_muscle_mass_kg?: number | null;
  skinfold_chest?: number | null;
  skinfold_axillary?: number | null;
  skinfold_thigh?: number | null;
  skinfold_triceps?: number | null;
  skinfold_subscapular?: number | null;
  skinfold_suprailiac?: number | null;
  skinfold_abdominal?: number | null;
  circ_neck?: number | null;
  circ_shoulder?: number | null;
  circ_chest_relaxed?: number | null;
  circ_arm_relaxed_right?: number | null;
  circ_arm_relaxed_left?: number | null;
  circ_arm_contracted_right?: number | null;
  circ_arm_contracted_left?: number | null;
  circ_forearm_right?: number | null;
  circ_forearm_left?: number | null;
  circ_waist?: number | null;
  circ_abdomen?: number | null;
  circ_hips?: number | null;
  circ_thigh_proximal_right?: number | null;
  circ_thigh_proximal_left?: number | null;
  circ_calf_right?: number | null;
  circ_calf_left?: number | null;
}

export interface BodyLogResponse extends BodyLogCreate {
  id: number;
  calculated_body_fat_percent: number | null;
  calculated_body_density: number | null;
  created_at: string;
}

// ── Dashboard ──
export interface WeightHistoryEntry {
  date: string;
  weight_kg: number;
}

export interface BodyFatHistoryEntry {
  date: string;
  body_fat_percent: number;
}

export interface DashboardStats {
  weight_history: WeightHistoryEntry[];
  body_fat_history: BodyFatHistoryEntry[];
  current_plan_summary: {
    target_calories: number;
    target_protein: number;
    target_carbs: number;
    target_fat: number;
    actual_calories: number;
    actual_protein: number;
    actual_carbs: number;
    actual_fat: number;
  } | null;
  latest_body_log: BodyLogResponse | null;
}

// ── Coach ──
export interface StagnationCheckRequest {
  user_id: string;
}

export type AnalysisState = "weight_loss" | "slow_gain" | "optimal" | "high_velocity";

export interface StagnationResult {
  current_week_avg_weight: number;
  previous_week_avg_weight: number;
  weight_change_kg: number;
  anchor_date: string | null;
  anchor_weight_kg: number | null;

  // Time-normalized rate
  weekly_rate: number;
  monthly_projection: number;
  weeks_elapsed: number;
  analysis_state: AnalysisState;

  // Stop-condition flags
  suggest_cutting: boolean;
  cutting_reasons: string[];
  current_body_fat_percent: number | null;
  waist_change_cm: number | null;
  arm_change_cm: number | null;

  // Verdict
  is_stagnating: boolean;
  message: string;

  // Calorie/Carb adjustment (can be positive or negative)
  suggested_calorie_adjustment: number | null;
  suggested_carb_adjustment_g: number | null;

  // Before vs After comparison
  current_carbs_g: number | null;
  current_carbs_per_kg: number | null;
  suggested_carbs_g: number | null;
  suggested_carbs_per_kg: number | null;
  current_calories: number | null;
  suggested_calories: number | null;

  // New targets
  new_target_calories: number | null;
  new_target_carbs: number | null;
}

export interface ApplySuggestionRequest {
  user_id: string;
  calorie_adjustment: number;
  carb_adjustment_g: number;
  w_curr: number;
  w_prev: number;
}

export interface DismissSuggestionRequest {
  user_id: string;
  w_curr: number;
  w_prev: number;
}

export interface MessageResponse {
  message: string;
  detail?: string;
}
