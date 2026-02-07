"""
TACO Database CSV Importer Service
====================================
Handles the parsing, cleaning, and bulk insertion of nutritional data
from the TACO (Tabela Brasileira de Composição de Alimentos) CSV file.

IMPORTANT NOTES:
  - TACO values are already per 100g — we do NOT divide them.
  - The CSV may have bad lines, special characters, and non-numeric values.
  - Non-numeric values like "NA", "Tr" (trace), "*", "" are treated as 0.0.
  - We use pandas for robust CSV parsing and data cleaning.
  - Bulk insert is used for performance (one INSERT for all rows).

Column Mapping (CSV -> Model):
  " Nome"           -> FoodItem.name         (note: leading space in CSV header)
  " Energia (kcal)" -> FoodItem.calories_kcal
  " Proteína (g)"   -> FoodItem.protein_g
  " Carboidrato (g)"-> FoodItem.carbs_g
  " Lipídeos (g)"   -> FoodItem.fat_g
"""

import io
import logging

import pandas as pd
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FoodItem

logger = logging.getLogger(__name__)

# Map CSV column names (with their quirky spaces) to our model fields.
# The CSV from TACO has leading spaces in column names.
COLUMN_MAPPING = {
    "Nome": "name",
    "Energia (kcal)": "calories_kcal",
    "Proteína (g)": "protein_g",
    "Carboidrato (g)": "carbs_g",
    "Lipídeos (g)": "fat_g",
}

# Values that should be treated as zero (non-numeric placeholders in the CSV)
NON_NUMERIC_PLACEHOLDERS = {"NA", "Tr", "na", "tr", "*", "-", ".."}


def clean_numeric_value(value) -> float:
    """
    Convert a potentially messy CSV value to a clean float.
    
    Handles these cases:
      - Already a number: return as-is
      - NaN: return 0.0
      - "NA", "Tr", "*", etc.: return 0.0
      - String with comma decimal separator: replace comma with dot
      - Empty string: return 0.0
      - Any other unparseable string: return 0.0
    
    Args:
        value: The raw value from the CSV cell
        
    Returns:
        float: The cleaned numeric value, or 0.0 if not parseable
    """
    # Handle pandas NaN
    if pd.isna(value):
        return 0.0

    # Convert to string for processing
    str_value = str(value).strip()

    # Check if it's a known non-numeric placeholder
    if str_value in NON_NUMERIC_PLACEHOLDERS or str_value == "":
        return 0.0

    # Handle comma as decimal separator (e.g., "12,5" -> "12.5")
    str_value = str_value.replace(",", ".")

    try:
        result = float(str_value)
        # Ensure non-negative (negative nutrition values don't make sense)
        return max(result, 0.0)
    except (ValueError, TypeError):
        # If we still can't parse it, log and return 0.0
        logger.warning(f"Could not parse nutritional value: '{value}' -> defaulting to 0.0")
        return 0.0


def clean_column_name(col: str) -> str:
    """
    Strip leading/trailing whitespace from a column name.
    The TACO CSV often has columns like " Nome" instead of "Nome".
    """
    return col.strip()


async def import_taco_csv(db: AsyncSession, file_content: bytes) -> dict:
    """
    Parse a TACO CSV file and bulk-insert the food items into the database.
    
    Processing Steps:
      1. Read the CSV using pandas (skip bad lines gracefully)
      2. Clean column names (strip whitespace)
      3. Map CSV columns to model fields
      4. Clean all numeric values (handle NA, Tr, commas, etc.)
      5. Bulk insert all valid rows into the food_items table
    
    Args:
        db: The async database session
        file_content: Raw bytes of the uploaded CSV file
        
    Returns:
        dict with keys: total_rows_processed, rows_imported, rows_skipped
    """
    # Step 1: Read the CSV with pandas
    # - on_bad_lines='skip' silently drops malformed rows
    # - encoding tries utf-8 first (most common for TACO exports)
    try:
        # Try UTF-8 first (standard encoding)
        df = pd.read_csv(
            io.BytesIO(file_content),
            sep=",",
            encoding="utf-8",
            on_bad_lines="skip",
            dtype=str,  # Read everything as strings first for manual cleaning
        )
    except UnicodeDecodeError:
        # Fall back to latin-1 (common for Brazilian government data)
        df = pd.read_csv(
            io.BytesIO(file_content),
            sep=",",
            encoding="latin-1",
            on_bad_lines="skip",
            dtype=str,
        )

    logger.info(f"CSV loaded: {len(df)} rows, columns: {list(df.columns)}")

    # Step 2: Clean column names (strip whitespace)
    df.columns = [clean_column_name(col) for col in df.columns]
    logger.info(f"Cleaned column names: {list(df.columns)}")

    # Step 3: Verify that all required columns exist in the CSV
    required_csv_columns = list(COLUMN_MAPPING.keys())
    missing_columns = [col for col in required_csv_columns if col not in df.columns]

    if missing_columns:
        raise ValueError(
            f"CSV is missing required columns: {missing_columns}. "
            f"Available columns: {list(df.columns)}"
        )

    # Step 4: Select only the columns we need and rename them
    df = df[required_csv_columns].rename(columns=COLUMN_MAPPING)

    # Step 5: Clean the data
    total_rows = len(df)
    rows_skipped = 0

    # Drop rows where name is empty or NaN (a food must have a name)
    df = df.dropna(subset=["name"])
    df = df[df["name"].str.strip() != ""]
    rows_skipped += total_rows - len(df)

    # Clean the name column (strip whitespace)
    df["name"] = df["name"].str.strip()

    # Clean all numeric columns using our robust cleaner
    numeric_columns = ["calories_kcal", "protein_g", "carbs_g", "fat_g"]
    for col in numeric_columns:
        df[col] = df[col].apply(clean_numeric_value)

    logger.info(f"After cleaning: {len(df)} valid rows, {rows_skipped} skipped")

    # Step 6: Bulk insert into the database
    # Convert DataFrame to a list of dicts for SQLAlchemy bulk insert
    records = df.to_dict(orient="records")

    if records:
        # Use SQLAlchemy's bulk insert for maximum performance
        # This generates a single INSERT statement with all rows
        await db.execute(insert(FoodItem), records)
        await db.commit()
        logger.info(f"Successfully inserted {len(records)} food items")

    return {
        "total_rows_processed": total_rows,
        "rows_imported": len(records),
        "rows_skipped": rows_skipped,
    }
