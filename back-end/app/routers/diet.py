"""
Diet Plan Router
=================
Endpoints for managing diet plans, meals, and meal items.

Endpoints:
  POST /diet/plans              - Create a new diet plan
  GET  /diet/current            - Get the full current diet plan with calculated macros
  POST /diet/plans/{id}/meals   - Add a meal to a plan
  POST /diet/meals/{id}/add_item - Add a food item to a meal
  DELETE /diet/meal-items/{id}  - Remove a food item from a meal
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import DietPlan, FoodItem, Meal, MealItem
from app.schemas import (
    DietPlanCreate,
    DietPlanFullResponse,
    DietPlanResponse,
    DietPlanUpdate,
    MealCreate,
    MealItemCreate,
    MealItemResponse,
    MealItemUpdate,
    MealResponse,
    MessageResponse,
)
from app.services.diet_calculator import get_current_diet_full

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diet", tags=["Diet Plans"])


@router.post("/plans", response_model=DietPlanResponse, status_code=201)
async def create_diet_plan(
    plan: DietPlanCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new diet plan with daily macro targets.
    
    If is_active=True (default), any other active plans for this user
    will be deactivated automatically. Only one plan can be active at a time.
    
    Example request:
    {
        "target_calories": 3000,
        "target_protein": 180,
        "target_carbs": 375,
        "target_fat": 83
    }
    """
    # If the new plan should be active, deactivate all other plans for this user
    if plan.is_active:
        stmt = (
            select(DietPlan)
            .where(DietPlan.user_id == plan.user_id)
            .where(DietPlan.is_active == True)
        )
        result = await db.execute(stmt)
        existing_active_plans = result.scalars().all()

        for existing_plan in existing_active_plans:
            existing_plan.is_active = False
            logger.info(f"Deactivated plan ID {existing_plan.id} for user '{plan.user_id}'")

    # Create the new plan
    db_plan = DietPlan(**plan.model_dump())
    db.add(db_plan)
    await db.commit()
    await db.refresh(db_plan)

    logger.info(
        f"Created diet plan ID {db_plan.id} for user '{db_plan.user_id}' "
        f"(calories={db_plan.target_calories}, protein={db_plan.target_protein}g)"
    )
    return db_plan


@router.get("/current", response_model=DietPlanFullResponse)
async def get_current_diet(
    user_id: str = "default_user",
    db: AsyncSession = Depends(get_db),
):
    """
    Get the complete current (active) diet plan with full hierarchy.
    
    Returns:
      - Plan metadata (targets)
      - All meals with their items
      - Calculated macros for each item (based on quantity * per-100g values)
      - Meal-level totals
      - Plan-level grand totals
      - Target vs Actual comparison for each macro
    
    This is the primary endpoint for the diet overview dashboard.
    """
    try:
        plan_data = await get_current_diet_full(db, user_id)
        return plan_data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/plans/{plan_id}/meals", response_model=MealResponse, status_code=201)
async def add_meal_to_plan(
    plan_id: int,
    meal: MealCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Add a new meal to an existing diet plan.
    
    Meals represent eating occasions during the day (e.g., "Breakfast",
    "Post-workout shake", "Dinner"). The order_index controls display order.
    
    Example:
      POST /diet/plans/1/meals
      { "name": "Breakfast", "order_index": 0 }
    """
    # Verify the plan exists
    stmt = select(DietPlan).where(DietPlan.id == plan_id)
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()

    if not plan:
        raise HTTPException(
            status_code=404,
            detail=f"Diet plan with ID {plan_id} not found."
        )

    # Create the meal
    db_meal = Meal(
        diet_plan_id=plan_id,
        name=meal.name,
        order_index=meal.order_index,
    )
    db.add(db_meal)
    await db.commit()
    await db.refresh(db_meal)

    logger.info(f"Added meal '{db_meal.name}' to plan ID {plan_id}")

    return MealResponse(
        id=db_meal.id,
        name=db_meal.name,
        order_index=db_meal.order_index,
        items=[],
        total_calories=0.0,
        total_protein=0.0,
        total_carbs=0.0,
        total_fat=0.0,
    )


@router.post("/meals/{meal_id}/add_item", response_model=MealItemResponse, status_code=201)
async def add_item_to_meal(
    meal_id: int,
    item: MealItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Add a food item to a meal with a specific quantity.
    
    The quantity_grams specifies how much of the food the user will eat.
    Macros are calculated using: (quantity_grams / 100) * value_per_100g
    
    Example:
      POST /diet/meals/1/add_item
      { "food_item_id": 42, "quantity_grams": 200 }
      
      If food #42 has 165 kcal/100g, the calculated calories = (200/100) * 165 = 330 kcal
    """
    # Verify the meal exists
    stmt = select(Meal).where(Meal.id == meal_id)
    result = await db.execute(stmt)
    meal = result.scalar_one_or_none()

    if not meal:
        raise HTTPException(
            status_code=404,
            detail=f"Meal with ID {meal_id} not found."
        )

    # Verify the food item exists
    food_stmt = select(FoodItem).where(FoodItem.id == item.food_item_id)
    food_result = await db.execute(food_stmt)
    food = food_result.scalar_one_or_none()

    if not food:
        raise HTTPException(
            status_code=404,
            detail=f"Food item with ID {item.food_item_id} not found."
        )

    # Create the meal item (the link between meal and food)
    db_item = MealItem(
        meal_id=meal_id,
        food_item_id=item.food_item_id,
        quantity_grams=item.quantity_grams,
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)

    # Calculate the macros for the response
    # Formula: (quantity / 100) * value_per_100g
    qty_factor = item.quantity_grams / 100

    logger.info(
        f"Added {item.quantity_grams}g of '{food.name}' to meal ID {meal_id} "
        f"({round(qty_factor * food.calories_kcal, 2)} kcal)"
    )

    return MealItemResponse(
        id=db_item.id,
        food_item_id=food.id,
        food_item_name=food.name,
        quantity_grams=item.quantity_grams,
        calculated_calories=round(qty_factor * food.calories_kcal, 2),
        calculated_protein=round(qty_factor * food.protein_g, 2),
        calculated_carbs=round(qty_factor * food.carbs_g, 2),
        calculated_fat=round(qty_factor * food.fat_g, 2),
    )


@router.put("/plans/{plan_id}/targets", response_model=DietPlanResponse)
async def update_diet_plan_targets(
    plan_id: int,
    update: DietPlanUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update the macro targets of an existing diet plan.
    Only provided fields will be updated.
    """
    stmt = select(DietPlan).where(DietPlan.id == plan_id)
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()

    if not plan:
        raise HTTPException(
            status_code=404,
            detail=f"Diet plan with ID {plan_id} not found."
        )

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan, field, value)

    await db.commit()
    await db.refresh(plan)

    logger.info(f"Updated targets for plan ID {plan_id}: {update_data}")
    return plan


@router.put("/meal-items/{item_id}", response_model=MealItemResponse)
async def update_meal_item(
    item_id: int,
    update: MealItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update the quantity of a meal item.
    Returns the updated item with recalculated macros.
    """
    stmt = (
        select(MealItem)
        .where(MealItem.id == item_id)
        .options(selectinload(MealItem.food_item))
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Meal item with ID {item_id} not found."
        )

    item.quantity_grams = update.quantity_grams
    await db.commit()
    await db.refresh(item)

    food = item.food_item
    qty_factor = item.quantity_grams / 100

    logger.info(f"Updated meal item ID {item_id}: quantity={update.quantity_grams}g")

    return MealItemResponse(
        id=item.id,
        food_item_id=food.id,
        food_item_name=food.name,
        quantity_grams=item.quantity_grams,
        calculated_calories=round(qty_factor * food.calories_kcal, 2),
        calculated_protein=round(qty_factor * food.protein_g, 2),
        calculated_carbs=round(qty_factor * food.carbs_g, 2),
        calculated_fat=round(qty_factor * food.fat_g, 2),
    )


@router.delete("/meal-items/{item_id}", response_model=MessageResponse)
async def remove_meal_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Remove a food item from a meal.
    
    This deletes the MealItem record (the link between meal and food).
    The FoodItem itself is NOT deleted — only the association.
    """
    stmt = select(MealItem).where(MealItem.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Meal item with ID {item_id} not found."
        )

    await db.delete(item)
    await db.commit()

    logger.info(f"Removed meal item ID {item_id}")

    return MessageResponse(
        message="Meal item removed successfully.",
        detail=f"Removed item ID {item_id} from meal."
    )
