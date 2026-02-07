"""
Food Items Router
==================
Endpoints for managing the food items database.

Endpoints:
  GET  /foods/              - List and search food items
  POST /foods/              - Create a single food item (values per 100g)
  GET  /foods/{food_id}     - Get a specific food item by ID
  POST /foods/import-taco   - Bulk import from TACO CSV file
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import FoodItem
from app.schemas import FoodItemCreate, FoodItemResponse, ImportResult
from app.services.importer import import_taco_csv

logger = logging.getLogger(__name__)

# Create the router with a prefix and tag for OpenAPI docs
router = APIRouter(prefix="/foods", tags=["Foods"])


@router.get("/", response_model=list[FoodItemResponse])
async def list_foods(
    search: Optional[str] = Query(
        default=None,
        description="Search foods by name (case-insensitive partial match)"
    ),
    skip: int = Query(default=0, ge=0, description="Number of records to skip (pagination)"),
    limit: int = Query(default=50, ge=1, le=200, description="Max records to return"),
    db: AsyncSession = Depends(get_db),
):
    """
    List all food items, with optional search by name.
    
    Supports pagination via `skip` and `limit` parameters.
    If `search` is provided, filters foods by name using case-insensitive
    partial matching (ILIKE in PostgreSQL).
    
    Examples:
      GET /foods/                         -> All foods (first 50)
      GET /foods/?search=chicken          -> Foods containing "chicken"
      GET /foods/?search=rice&limit=10    -> First 10 foods containing "rice"
    """
    stmt = select(FoodItem)

    # Apply search filter if provided
    if search:
        # ilike = case-insensitive LIKE with % wildcards for partial matching
        stmt = stmt.where(FoodItem.name.ilike(f"%{search}%"))

    # Apply pagination and ordering
    stmt = stmt.order_by(FoodItem.name).offset(skip).limit(limit)

    result = await db.execute(stmt)
    foods = result.scalars().all()

    return foods


@router.post("/", response_model=FoodItemResponse, status_code=201)
async def create_food(
    food: FoodItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new food item manually.
    
    IMPORTANT: All nutritional values must be provided per 100 grams.
    This follows the standard nutritional label format.
    
    Example request body:
    {
        "name": "Chicken Breast (Grilled)",
        "calories_kcal": 165.0,
        "protein_g": 31.0,
        "carbs_g": 0.0,
        "fat_g": 3.6,
        "brand": "Generic"
    }
    """
    # Create the SQLAlchemy model instance from the Pydantic schema
    db_food = FoodItem(**food.model_dump())

    # Add to session and commit
    db.add(db_food)
    await db.commit()
    await db.refresh(db_food)  # Refresh to get the auto-generated ID and timestamp

    logger.info(f"Created food item: {db_food.name} (ID: {db_food.id})")
    return db_food


@router.get("/{food_id}", response_model=FoodItemResponse)
async def get_food(
    food_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific food item by its ID.
    
    Returns 404 if the food item doesn't exist.
    """
    stmt = select(FoodItem).where(FoodItem.id == food_id)
    result = await db.execute(stmt)
    food = result.scalar_one_or_none()

    if not food:
        raise HTTPException(
            status_code=404,
            detail=f"Food item with ID {food_id} not found."
        )

    return food


@router.post("/import-taco", response_model=ImportResult, status_code=201)
async def import_taco(
    file: UploadFile = File(
        ..., description="TACO CSV file to import"
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Bulk import food items from a TACO (Tabela Brasileira de Composição de Alimentos) CSV file.
    
    The CSV should have columns:
      - Nome (food name)
      - Energia (kcal) (calories per 100g)
      - Proteína (g) (protein per 100g)
      - Carboidrato (g) (carbs per 100g)
      - Lipídeos (g) (fat per 100g)
    
    Processing rules:
      - Values are stored exactly as they appear (already per 100g — NOT divided)
      - Non-numeric values (NA, Tr, *, empty) are converted to 0.0
      - Bad CSV lines are silently skipped
      - Uses bulk insert for performance
    
    Returns the number of rows processed, imported, and skipped.
    """
    # Validate the file type (basic check)
    if file.filename and not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file (.csv extension)."
        )

    # Read the entire file content into memory
    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty."
        )

    try:
        # Delegate to the importer service for all the heavy lifting
        result = await import_taco_csv(db, content)

        logger.info(
            f"TACO import complete: "
            f"{result['rows_imported']}/{result['total_rows_processed']} rows imported"
        )

        return ImportResult(
            message="TACO CSV imported successfully!",
            total_rows_processed=result["total_rows_processed"],
            rows_imported=result["rows_imported"],
            rows_skipped=result["rows_skipped"],
        )

    except ValueError as e:
        # Column mapping errors or other data issues
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"TACO import failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to import CSV: {str(e)}"
        )
