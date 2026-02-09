"""
Pydantic V2 Schemas (Request/Response Models)
================================================
These schemas define the shape of data that flows in and out of the API.

Naming Convention:
  - *Create   : Used for POST request bodies (creating new records)
  - *Response : Used for API responses (what the client receives back)
  - *Update   : Used for PUT/PATCH request bodies (modifying records)

All schemas use Pydantic V2 with model_config for configuration.
"""

import datetime

from pydantic import BaseModel, Field, model_validator


# ============================================================
# FOOD ITEM SCHEMAS
# ============================================================

class FoodItemCreate(BaseModel):
    """
    Schema for creating a new food item.
    All nutritional values must be provided per 100 grams.
    
    If calories_kcal is not provided (or is 0), it will be automatically
    calculated from macros: (protein * 4) + (carbs * 4) + (fat * 9).
    """
    name: str = Field(..., min_length=1, max_length=255, description="Name of the food")
    calories_kcal: float = Field(
        default=0, ge=0, description="Calories per 100g (auto-calculated from macros if 0 or omitted)"
    )
    protein_g: float = Field(
        ..., ge=0, description="Protein in grams per 100g"
    )
    carbs_g: float = Field(
        ..., ge=0, description="Carbohydrates in grams per 100g"
    )
    fat_g: float = Field(
        ..., ge=0, description="Fat in grams per 100g"
    )
    brand: str | None = Field(
        default=None, max_length=255, description="Brand name (optional)"
    )

    @model_validator(mode="after")
    def compute_calories_from_macros(self) -> "FoodItemCreate":
        """If calories not provided or zero, derive from macros."""
        if self.calories_kcal == 0:
            self.calories_kcal = round(
                (self.protein_g * 4) + (self.carbs_g * 4) + (self.fat_g * 9), 2
            )
        return self


class FoodItemResponse(BaseModel):
    """Schema returned when a food item is fetched from the API."""
    id: int
    name: str
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    brand: str | None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}  # Allows creating from SQLAlchemy model


# ============================================================
# DIET PLAN SCHEMAS
# ============================================================

class DietPlanCreate(BaseModel):
    """Schema for creating a new diet plan with daily macro targets."""
    user_id: str = Field(default="default_user", description="User identifier")
    target_calories: float = Field(..., ge=0, description="Daily calorie target")
    target_protein: float = Field(..., ge=0, description="Daily protein target (g)")
    target_carbs: float = Field(..., ge=0, description="Daily carb target (g)")
    target_fat: float = Field(..., ge=0, description="Daily fat target (g)")
    is_active: bool = Field(default=True, description="Whether this plan is currently active")


class DietPlanResponse(BaseModel):
    """Schema returned for a diet plan (without meals — see full response below)."""
    id: int
    user_id: str
    target_calories: float
    target_protein: float
    target_carbs: float
    target_fat: float
    is_active: bool
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ============================================================
# MEAL SCHEMAS
# ============================================================

class MealCreate(BaseModel):
    """Schema for creating a new meal within a diet plan."""
    name: str = Field(
        ..., min_length=1, max_length=255,
        description="Meal name (e.g., 'Breakfast', 'Pre-workout')"
    )
    order_index: int = Field(
        default=0, ge=0,
        description="Display order (0 = first meal of the day)"
    )


class MealRename(BaseModel):
    """Schema for renaming an existing meal."""
    name: str = Field(
        ..., min_length=1, max_length=255,
        description="New name for the meal"
    )


class MealItemCreate(BaseModel):
    """
    Schema for adding a food item to a meal.
    Only needs the food_item_id and the quantity in grams.
    """
    food_item_id: int = Field(..., description="ID of the food item to add")
    quantity_grams: float = Field(
        ..., gt=0, description="Amount in grams the user will eat"
    )


class MealItemUpdate(BaseModel):
    """Schema for updating a meal item's quantity."""
    quantity_grams: float = Field(..., gt=0, description="New quantity in grams")


class MealItemResponse(BaseModel):
    """
    Schema returned for a meal item, including the calculated macros.
    The calculated fields show the actual nutritional values based on quantity.
    """
    id: int
    food_item_id: int
    food_item_name: str  # Convenience field — avoids a separate lookup
    quantity_grams: float

    # Calculated macros based on the formula: (quantity / 100) * value_per_100g
    calculated_calories: float
    calculated_protein: float
    calculated_carbs: float
    calculated_fat: float

    model_config = {"from_attributes": True}


class MealResponse(BaseModel):
    """Schema for a complete meal with all its items and totals."""
    id: int
    name: str
    order_index: int
    items: list[MealItemResponse] = []

    # Meal-level totals (sum of all items in this meal)
    total_calories: float = 0.0
    total_protein: float = 0.0
    total_carbs: float = 0.0
    total_fat: float = 0.0

    model_config = {"from_attributes": True}


# ============================================================
# DIET VARIATION SCHEMAS
# ============================================================

class DietVariationCreate(BaseModel):
    """Schema for creating a new diet variation."""
    name: str = Field(
        ..., min_length=1, max_length=255,
        description="Variation name (e.g., 'Principal', 'Substituição')"
    )
    order_index: int = Field(
        default=0, ge=0,
        description="Display order (0 = first variation)"
    )


class DietVariationResponse(BaseModel):
    """Schema for a diet variation with all its meals and calculated totals."""
    id: int
    name: str
    order_index: int
    created_at: datetime.datetime
    meals: list[MealResponse] = []

    # Variation-level totals (sum of all meals in this variation)
    total_calories: float = 0.0
    total_protein: float = 0.0
    total_carbs: float = 0.0
    total_fat: float = 0.0

    model_config = {"from_attributes": True}


class DietVariationRename(BaseModel):
    """Schema for renaming an existing variation."""
    name: str = Field(
        ..., min_length=1, max_length=255,
        description="New name for the variation"
    )


# ============================================================
# FULL DIET PLAN (Hierarchical: Plan -> Variations -> Meals -> Items)
# ============================================================

class MacroComparison(BaseModel):
    """
    Shows the difference between target and actual macro intake.
    Positive difference = surplus (eating more than target).
    Negative difference = deficit (eating less than target).
    """
    target: float
    actual: float
    difference: float  # actual - target
    percentage: float  # (actual / target) * 100 — how close to target


class DietPlanUpdate(BaseModel):
    """Schema for updating diet plan targets."""
    target_calories: float | None = Field(default=None, ge=0)
    target_protein: float | None = Field(default=None, ge=0)
    target_carbs: float | None = Field(default=None, ge=0)
    target_fat: float | None = Field(default=None, ge=0)


class DietPlanFullResponse(BaseModel):
    """
    The complete diet plan hierarchy returned by GET /diet/current.
    Includes: Plan info -> Variations -> Meals -> Items, plus macro comparisons.
    """
    id: int
    user_id: str
    is_active: bool
    created_at: datetime.datetime

    # Targets
    target_calories: float = 0.0
    target_protein: float = 0.0
    target_carbs: float = 0.0
    target_fat: float = 0.0

    # All variations with their meals and items
    variations: list[DietVariationResponse] = []

    # All meals with their items (from the active/first variation for backward compat)
    meals: list[MealResponse] = []

    # Grand totals across all meals (from the first variation)
    total_calories: float = 0.0
    total_protein: float = 0.0
    total_carbs: float = 0.0
    total_fat: float = 0.0

    # Comparison: target vs actual for each macro (from the first variation)
    calories_comparison: MacroComparison | None = None
    protein_comparison: MacroComparison | None = None
    carbs_comparison: MacroComparison | None = None
    fat_comparison: MacroComparison | None = None

    model_config = {"from_attributes": True}


# ============================================================
# BODY LOG SCHEMAS
# ============================================================

class BodyLogCreate(BaseModel):
    """
    Schema for creating a new body measurement log.
    Only date and weight are required — everything else is optional.
    This lets the user log just weight one day, and full measurements another.
    """
    date: datetime.date = Field(..., description="Date of the measurement")
    user_id: str = Field(default="default_user", description="User identifier")
    weight_kg: float = Field(..., gt=0, description="Body weight in kilograms")

    # Bioimpedance (from smart scale / InBody machine)
    bio_body_fat_percent: float | None = Field(default=None, ge=0, le=100)
    bio_muscle_mass_kg: float | None = Field(default=None, ge=0)

    # Skinfold measurements in millimeters (Pollock 7-fold protocol)
    skinfold_chest: float | None = Field(default=None, ge=0)
    skinfold_axillary: float | None = Field(default=None, ge=0)
    skinfold_triceps: float | None = Field(default=None, ge=0)
    skinfold_subscapular: float | None = Field(default=None, ge=0)
    skinfold_suprailiac: float | None = Field(default=None, ge=0)
    skinfold_abdominal: float | None = Field(default=None, ge=0)
    skinfold_thigh: float | None = Field(default=None, ge=0)

    # Circumference measurements in centimeters
    circ_neck: float | None = Field(default=None, ge=0)
    circ_shoulder: float | None = Field(default=None, ge=0)
    circ_chest_relaxed: float | None = Field(default=None, ge=0)
    circ_arm_relaxed_right: float | None = Field(default=None, ge=0)
    circ_arm_relaxed_left: float | None = Field(default=None, ge=0)
    circ_arm_contracted_right: float | None = Field(default=None, ge=0)
    circ_arm_contracted_left: float | None = Field(default=None, ge=0)
    circ_forearm_right: float | None = Field(default=None, ge=0)
    circ_forearm_left: float | None = Field(default=None, ge=0)
    circ_waist: float | None = Field(default=None, ge=0)
    circ_abdomen: float | None = Field(default=None, ge=0)
    circ_hips: float | None = Field(default=None, ge=0)
    circ_thigh_proximal_right: float | None = Field(default=None, ge=0)
    circ_thigh_proximal_left: float | None = Field(default=None, ge=0)
    circ_calf_right: float | None = Field(default=None, ge=0)
    circ_calf_left: float | None = Field(default=None, ge=0)


class BodyLogUpdate(BaseModel):
    """Schema for updating an existing body log entry."""
    date: datetime.date | None = None
    weight_kg: float | None = Field(default=None, gt=0)
    bio_body_fat_percent: float | None = Field(default=None, ge=0, le=100)
    bio_muscle_mass_kg: float | None = Field(default=None, ge=0)
    skinfold_chest: float | None = Field(default=None, ge=0)
    skinfold_axillary: float | None = Field(default=None, ge=0)
    skinfold_triceps: float | None = Field(default=None, ge=0)
    skinfold_subscapular: float | None = Field(default=None, ge=0)
    skinfold_suprailiac: float | None = Field(default=None, ge=0)
    skinfold_abdominal: float | None = Field(default=None, ge=0)
    skinfold_thigh: float | None = Field(default=None, ge=0)
    circ_neck: float | None = Field(default=None, ge=0)
    circ_shoulder: float | None = Field(default=None, ge=0)
    circ_chest_relaxed: float | None = Field(default=None, ge=0)
    circ_arm_relaxed_right: float | None = Field(default=None, ge=0)
    circ_arm_relaxed_left: float | None = Field(default=None, ge=0)
    circ_arm_contracted_right: float | None = Field(default=None, ge=0)
    circ_arm_contracted_left: float | None = Field(default=None, ge=0)
    circ_forearm_right: float | None = Field(default=None, ge=0)
    circ_forearm_left: float | None = Field(default=None, ge=0)
    circ_waist: float | None = Field(default=None, ge=0)
    circ_abdomen: float | None = Field(default=None, ge=0)
    circ_hips: float | None = Field(default=None, ge=0)
    circ_thigh_proximal_right: float | None = Field(default=None, ge=0)
    circ_thigh_proximal_left: float | None = Field(default=None, ge=0)
    circ_calf_right: float | None = Field(default=None, ge=0)
    circ_calf_left: float | None = Field(default=None, ge=0)


class BodyLogResponse(BaseModel):
    """Schema returned when a body log is fetched from the API."""
    id: int
    date: datetime.date
    user_id: str
    weight_kg: float

    # Bioimpedance
    bio_body_fat_percent: float | None
    bio_muscle_mass_kg: float | None

    # Skinfolds
    skinfold_chest: float | None
    skinfold_axillary: float | None
    skinfold_triceps: float | None
    skinfold_subscapular: float | None
    skinfold_suprailiac: float | None
    skinfold_abdominal: float | None
    skinfold_thigh: float | None

    # Circumferences
    circ_neck: float | None
    circ_shoulder: float | None
    circ_chest_relaxed: float | None
    circ_arm_relaxed_right: float | None
    circ_arm_relaxed_left: float | None
    circ_arm_contracted_right: float | None
    circ_arm_contracted_left: float | None
    circ_forearm_right: float | None
    circ_forearm_left: float | None
    circ_waist: float | None
    circ_abdomen: float | None
    circ_hips: float | None
    circ_thigh_proximal_right: float | None
    circ_thigh_proximal_left: float | None
    circ_calf_right: float | None
    circ_calf_left: float | None

    # Calculated body fat (if skinfolds were provided)
    calculated_body_fat_percent: float | None = None
    calculated_body_density: float | None = None

    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ============================================================
# COACH / STAGNATION SCHEMAS
# ============================================================

class StagnationCheckRequest(BaseModel):
    """Request body for the stagnation check endpoint."""
    user_id: str = Field(default="default_user", description="User to analyze")


class StagnationResult(BaseModel):
    """
    Result of the Floating Anchor weight analysis with Calories-First strategy.

    Uses weekly rate (kg/week) to classify progress into four states:
    weight_loss, slow_gain, optimal, high_velocity.

    Monthly target: 0.5 – 1.5 kg/month (0.125 – 0.375 kg/week).
    Also checks stop conditions: waist-vs-arm growth and body fat ceiling.
    """
    # Analysis data
    current_week_avg_weight: float = Field(description="Average weight of the current 7-day window")
    previous_week_avg_weight: float = Field(description="Average weight of the previous 7-day window")
    weight_change_kg: float = Field(description="Absolute weight difference between windows")

    # Anchor date info
    anchor_date: str | None = Field(default=None, description="Most recent body log date used as reference")
    anchor_weight_kg: float | None = Field(default=None, description="Weight on the anchor date")

    # Time-normalized rate
    weekly_rate: float = Field(default=0.0, description="Normalized weight change in kg/week")
    monthly_projection: float = Field(default=0.0, description="Projected monthly gain (weekly_rate * 4)")
    weeks_elapsed: float = Field(default=1.0, description="Weeks between the two analysis windows")
    analysis_state: str = Field(
        default="optimal",
        description="One of: weight_loss, slow_gain, optimal, high_velocity"
    )

    # Stop-condition flags
    suggest_cutting: bool = Field(default=False, description="True if a stop condition was triggered")
    cutting_reasons: list[str] = Field(default_factory=list, description="List of reasons to recommend cutting")
    current_body_fat_percent: float | None = Field(default=None, description="Latest body fat % if available")
    waist_change_cm: float | None = Field(default=None, description="Waist circumference change (cm)")
    arm_change_cm: float | None = Field(default=None, description="Arm circumference change (cm)")

    # Verdict
    is_stagnating: bool = Field(description="True if adjustment is recommended")
    message: str = Field(description="Human-readable explanation of the result")

    # Calorie/Carb adjustment (can be positive or negative)
    suggested_calorie_adjustment: float | None = Field(
        default=None, description="Recommended calorie adjustment (+ or −)"
    )
    suggested_carb_adjustment_g: float | None = Field(
        default=None, description="Recommended carb adjustment in grams (+ or −)"
    )

    # Before vs After comparison data
    current_carbs_g: float | None = Field(default=None, description="Current daily carb target (g)")
    current_carbs_per_kg: float | None = Field(default=None, description="Current carbs in g/kg")
    suggested_carbs_g: float | None = Field(default=None, description="Suggested daily carb target (g)")
    suggested_carbs_per_kg: float | None = Field(default=None, description="Suggested carbs in g/kg")
    current_calories: float | None = Field(default=None, description="Current daily calorie target")
    suggested_calories: float | None = Field(default=None, description="Suggested daily calorie target")

    # New targets if suggestion is applied
    new_target_calories: float | None = None
    new_target_carbs: float | None = None


class ApplySuggestionRequest(BaseModel):
    """Request body to apply a coach suggestion (increase or decrease) to the active diet plan."""
    user_id: str = Field(default="default_user")
    calorie_adjustment: float = Field(..., description="Calories to add/subtract from target (can be negative)")
    carb_adjustment_g: float = Field(..., description="Carbs (g) to add/subtract from target (can be negative)")
    # Fingerprint: the weight averages used in the analysis that produced this suggestion.
    # Stored in the plan so the coach can detect when new/different data arrives.
    w_curr: float = Field(..., description="Current window average weight used in the analysis")
    w_prev: float = Field(..., description="Previous window average weight used in the analysis")


class DismissSuggestionRequest(BaseModel):
    """Request body to dismiss a coach suggestion without changing diet targets."""
    user_id: str = Field(default="default_user")
    w_curr: float = Field(..., description="Current window average weight used in the analysis")
    w_prev: float = Field(..., description="Previous window average weight used in the analysis")


# ============================================================
# DASHBOARD / STATS SCHEMAS
# ============================================================

class DashboardStats(BaseModel):
    """
    Time-series data for the dashboard.
    Contains arrays of data points for charting weight and body composition over time.
    """
    # Weight history (for line chart)
    weight_history: list[dict] = Field(
        default_factory=list,
        description="List of {date, weight_kg} objects"
    )

    # Body fat history (for line chart — from bioimpedance or calculated)
    body_fat_history: list[dict] = Field(
        default_factory=list,
        description="List of {date, body_fat_percent} objects"
    )

    # Current diet plan summary
    current_plan_summary: dict | None = Field(
        default=None,
        description="Current plan targets vs actual intake"
    )

    # Latest body log entry
    latest_body_log: BodyLogResponse | None = None


# ============================================================
# GENERIC RESPONSE SCHEMAS
# ============================================================

class MessageResponse(BaseModel):
    """Simple message response for operations that don't return data."""
    message: str
    detail: str | None = None


class ImportResult(BaseModel):
    """Result of a CSV import operation."""
    message: str
    total_rows_processed: int
    rows_imported: int
    rows_skipped: int
