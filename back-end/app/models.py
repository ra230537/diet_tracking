"""
SQLAlchemy ORM Models
======================
Defines all database tables for the Bulking Control App.

Entity Relationships:
  - DietPlan (1) ---> (N) Meal          : A plan has many meals
  - Meal (1)     ---> (N) MealItem      : A meal has many items
  - FoodItem (1) ---> (N) MealItem      : A food can appear in many meal items
  - BodyLog is standalone (one record per date)

IMPORTANT: All nutritional values in FoodItem are stored per 100g.
The actual consumed amount is calculated at the MealItem level using:
  total_macro = (quantity_grams / 100) * food_item.macro_per_100g
"""

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ============================================================
# FOOD ITEM — Nutritional data stored per 100g (label format)
# ============================================================
class FoodItem(Base):
    """
    Represents a food item with its nutritional information per 100 grams.
    
    Example: "Chicken Breast" might have:
      - calories_kcal: 165.0  (per 100g)
      - protein_g: 31.0       (per 100g)
      - carbs_g: 0.0          (per 100g)
      - fat_g: 3.6            (per 100g)
    """
    __tablename__ = "food_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # All values are per 100 grams — this is the standard nutritional label format
    calories_kcal: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Optional brand field — useful to distinguish "Integral Rice (Brand A)" vs generic
    brand: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)

    # Timestamp for when this food was added to the database
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship: a food can be referenced by many MealItems
    meal_items: Mapped[list["MealItem"]] = relationship(
        "MealItem", back_populates="food_item", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<FoodItem(id={self.id}, name='{self.name}')>"


# ============================================================
# DIET PLAN — The user's current nutritional targets
# ============================================================
class DietPlan(Base):
    """
    Represents a nutritional goal/plan for a user.
    
    Only one plan should be active at a time (is_active=True).
    Contains daily macro targets that the user is aiming for.
    """
    __tablename__ = "diet_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # In a multi-user system, this would be a FK to a users table.
    # For now, it's a simple string identifier (e.g., "user_1").
    user_id: Mapped[str] = mapped_column(String(100), nullable=False, default="default_user")

    # Daily targets — what the user wants to hit each day
    target_calories: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    target_protein: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    target_carbs: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    target_fat: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Only one plan can be active at a time
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Tracks when the coach last applied an adjustment to this plan.
    # Used to prevent the stagnation check from suggesting repeated increases
    # before the user has had a chance to log new weight data.
    last_coach_adjustment_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    # Stores the anchor date (T_curr) used when the last adjustment was made.
    last_coach_anchor_date: Mapped[date | None] = mapped_column(
        Date, nullable=True, default=None
    )

    # Fingerprint: the W_curr and W_prev averages used for the last adjustment.
    # If these change (new log, deleted log, edited weight), the adjustment
    # is considered stale and a new suggestion can be made.
    last_coach_w_curr: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=None
    )
    last_coach_w_prev: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=None
    )

    # Relationship: a plan has many variations (e.g., "Principal", "Substituição")
    variations: Mapped[list["DietVariation"]] = relationship(
        "DietVariation", back_populates="diet_plan", lazy="selectin",
        cascade="all, delete-orphan",
        order_by="DietVariation.order_index",
    )

    # Relationship: a plan has many meals (e.g., Breakfast, Lunch, Dinner)
    meals: Mapped[list["Meal"]] = relationship(
        "Meal", back_populates="diet_plan", lazy="selectin",
        cascade="all, delete-orphan",  # Delete meals when plan is deleted
        order_by="Meal.order_index",   # Always return meals in order
    )

    def __repr__(self) -> str:
        return f"<DietPlan(id={self.id}, user='{self.user_id}', active={self.is_active})>"


# ============================================================
# DIET VARIATION — A named variation of a diet plan
# ============================================================
class DietVariation(Base):
    """
    A named variation within a DietPlan (e.g., "Principal", "Substituição").

    All variations share the same macro targets from their parent DietPlan.
    The idea is to allow multiple meal arrangements (e.g., a main diet
    and an alternative day with food substitutions).

    The order_index controls display order (0 = first / default variation).
    """
    __tablename__ = "diet_variations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Which diet plan this variation belongs to
    diet_plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("diet_plans.id", ondelete="CASCADE"), nullable=False
    )

    # Human-readable name like "Principal", "Dia de substituição"
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="Principal")

    # Controls display order (0 = first / default variation)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    diet_plan: Mapped["DietPlan"] = relationship("DietPlan", back_populates="variations")
    meals: Mapped[list["Meal"]] = relationship(
        "Meal", back_populates="variation", lazy="selectin",
        cascade="all, delete-orphan",
        order_by="Meal.order_index",
    )

    def __repr__(self) -> str:
        return f"<DietVariation(id={self.id}, name='{self.name}')>"


# ============================================================
# MEAL — A named meal within a diet variation (e.g., "Breakfast")
# ============================================================
class Meal(Base):
    """
    A meal slot within a DietVariation (e.g., "Breakfast", "Pre-workout", "Dinner").
    
    The order_index field controls the display order (0 = first meal of the day).
    Each meal contains multiple MealItems (the actual foods being eaten).
    """
    __tablename__ = "meals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Which diet plan this meal belongs to (kept for backward compatibility)
    diet_plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("diet_plans.id", ondelete="CASCADE"), nullable=False
    )

    # Which variation this meal belongs to (nullable for migration of existing data)
    variation_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("diet_variations.id", ondelete="CASCADE"), nullable=True
    )

    # Human-readable name like "Breakfast", "Lunch", "Pre-workout snack"
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Controls the order in which meals are displayed (0 = first)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    diet_plan: Mapped["DietPlan"] = relationship("DietPlan", back_populates="meals")
    variation: Mapped["DietVariation | None"] = relationship("DietVariation", back_populates="meals")
    items: Mapped[list["MealItem"]] = relationship(
        "MealItem", back_populates="meal", lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Meal(id={self.id}, name='{self.name}')>"


# ============================================================
# MEAL ITEM — Links a FoodItem to a Meal with a specific quantity
# ============================================================
class MealItem(Base):
    """
    The junction/link table between Meal and FoodItem.
    
    This is where the user specifies HOW MUCH of a food they eat.
    The quantity_grams field stores the actual portion size.
    
    CALCULATION FORMULA:
      total_calories = (quantity_grams / 100) * food_item.calories_kcal
      total_protein  = (quantity_grams / 100) * food_item.protein_g
      total_carbs    = (quantity_grams / 100) * food_item.carbs_g
      total_fat      = (quantity_grams / 100) * food_item.fat_g
    
    Example: If the user eats 200g of Chicken Breast (165 kcal/100g):
      total_calories = (200 / 100) * 165 = 330 kcal
    """
    __tablename__ = "meal_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Which meal this item belongs to
    meal_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("meals.id", ondelete="CASCADE"), nullable=False
    )

    # Which food is being eaten
    food_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False
    )

    # The actual amount the user eats, in grams
    quantity_grams: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    meal: Mapped["Meal"] = relationship("Meal", back_populates="items")
    food_item: Mapped["FoodItem"] = relationship("FoodItem", back_populates="meal_items")

    # ----- Computed Properties (not stored in DB) -----
    # These calculate the actual macros based on the quantity eaten.

    @property
    def calculated_calories(self) -> float:
        """Calculate actual calories based on quantity eaten."""
        return round((self.quantity_grams / 100) * self.food_item.calories_kcal, 2)

    @property
    def calculated_protein(self) -> float:
        """Calculate actual protein based on quantity eaten."""
        return round((self.quantity_grams / 100) * self.food_item.protein_g, 2)

    @property
    def calculated_carbs(self) -> float:
        """Calculate actual carbs based on quantity eaten."""
        return round((self.quantity_grams / 100) * self.food_item.carbs_g, 2)

    @property
    def calculated_fat(self) -> float:
        """Calculate actual fat based on quantity eaten."""
        return round((self.quantity_grams / 100) * self.food_item.fat_g, 2)

    def __repr__(self) -> str:
        return f"<MealItem(id={self.id}, food_id={self.food_item_id}, qty={self.quantity_grams}g)>"


# ============================================================
# BODY LOG — Daily/Weekly body measurements and progress
# ============================================================
class BodyLog(Base):
    """
    Stores the user's body measurements for a given date.
    
    Supports three types of measurements:
    1. Basic: weight only
    2. Bioimpedance: body fat %, muscle mass from a scale/device
    3. Skinfold (Pollock 7-fold): manual caliper measurements
    4. Circumferences: tape measure around body parts
    
    All measurement fields are optional — the user can log just weight,
    or weight + skinfolds, or everything at once. This flexibility
    allows gradual adoption of more detailed tracking.
    """
    __tablename__ = "body_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # The date of the measurement (only one log per date ideally)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # User identifier (same as in DietPlan)
    user_id: Mapped[str] = mapped_column(String(100), nullable=False, default="default_user")

    # ----- Basic Measurement -----
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)

    # ----- Bioimpedance Fields (from smart scale / InBody) -----
    # These come from electronic devices that estimate body composition
    bio_body_fat_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    bio_muscle_mass_kg: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ----- Skinfold Fields (Pollock 7-fold protocol) -----
    # Measured with a caliper in millimeters (mm)
    # These 7 sites are used to calculate body density and then body fat %
    skinfold_chest: Mapped[float | None] = mapped_column(Float, nullable=True)
    skinfold_axillary: Mapped[float | None] = mapped_column(Float, nullable=True)
    skinfold_triceps: Mapped[float | None] = mapped_column(Float, nullable=True)
    skinfold_subscapular: Mapped[float | None] = mapped_column(Float, nullable=True)
    skinfold_suprailiac: Mapped[float | None] = mapped_column(Float, nullable=True)
    skinfold_abdominal: Mapped[float | None] = mapped_column(Float, nullable=True)
    skinfold_thigh: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ----- Circumference Fields (in centimeters) -----
    # Tape measurements taken around various body parts
    circ_neck: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_shoulder: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_chest_relaxed: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_arm_relaxed_right: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_arm_relaxed_left: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_arm_contracted_right: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_arm_contracted_left: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_forearm_right: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_forearm_left: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_waist: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_abdomen: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_hips: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_thigh_proximal_right: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_thigh_proximal_left: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_calf_right: Mapped[float | None] = mapped_column(Float, nullable=True)
    circ_calf_left: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Timestamp for when this log entry was created
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<BodyLog(id={self.id}, date={self.date}, weight={self.weight_kg}kg)>"
