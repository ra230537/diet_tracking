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
    """
    name: str = Field(..., min_length=1, max_length=255, description="Name of the food")
    calories_kcal: float = Field(
        ..., ge=0, description="Calories per 100g"
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
# FULL DIET PLAN (Hierarchical: Plan -> Meals -> Items)
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
    Includes: Plan info -> Meals -> Items, plus macro comparisons.
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

    # All meals with their items
    meals: list[MealResponse] = []

    # Grand totals across all meals
    total_calories: float = 0.0
    total_protein: float = 0.0
    total_carbs: float = 0.0
    total_fat: float = 0.0

    # Comparison: target vs actual for each macro
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
    Result of the stagnation analysis.
    
    If is_stagnating is True, the suggestion fields will contain
    recommended increases to break through the plateau.
    """
    # Analysis data
    current_week_avg_weight: float = Field(description="Average weight of the last 7 days")
    previous_week_avg_weight: float = Field(description="Average weight of days 8-14")
    weight_change_kg: float = Field(description="Difference between current and previous week")

    # Verdict
    is_stagnating: bool = Field(description="True if weight gain <= 0.1 kg")
    message: str = Field(description="Human-readable explanation of the result")

    # Suggestion (only populated if stagnating)
    suggested_carb_increase_g: float | None = Field(
        default=None, description="Recommended carb increase in grams"
    )
    suggested_calorie_increase: float | None = Field(
        default=None, description="Recommended calorie increase (carb increase * 4)"
    )

    # New targets if suggestion is applied
    new_target_calories: float | None = None
    new_target_carbs: float | None = None


class ApplySuggestionRequest(BaseModel):
    """Request body to apply a stagnation suggestion to the active diet plan."""
    user_id: str = Field(default="default_user")
    calorie_increase: float = Field(..., gt=0, description="Calories to add to target")
    carb_increase_g: float = Field(..., gt=0, description="Carbs (g) to add to target")


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
