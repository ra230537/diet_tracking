"""
Body Fat Calculation Service
==============================
Implements the Pollock 7-Skinfold method for estimating body fat percentage.

The Pollock 7-site skinfold method is one of the most widely used and validated
methods for estimating body composition. It uses caliper measurements from
7 sites on the body to calculate body density, which is then converted to
body fat percentage using the Siri equation.

FORMULA (Jackson & Pollock, 1978 — for males):
  Body Density = 1.112 - (0.00043499 × S) + (0.00000055 × S²) - (0.00028826 × Age)
  
  Where S = sum of 7 skinfolds (in mm):
    chest, axillary, triceps, subscapular, suprailiac, abdominal, thigh

SIRI EQUATION (1961):
  Body Fat % = (495 / Body Density) - 450

NOTE: This implementation uses the male equation. For a production app,
you would also implement the female equation and let the user specify sex.
"""

import logging

logger = logging.getLogger(__name__)


def calculate_body_density_pollock_7(
    sum_of_skinfolds_mm: float,
    age_years: int = 25,
) -> float:
    """
    Calculate body density using the Pollock 7-skinfold formula (male equation).
    
    This is the Jackson & Pollock (1978) generalized equation for males.
    It uses the sum of 7 skinfold measurements to predict body density.
    
    Args:
        sum_of_skinfolds_mm: Sum of all 7 skinfold measurements in millimeters
        age_years: Age of the subject in years (default: 25)
    
    Returns:
        Body density in g/cm³ (typically between 1.0 and 1.1)
    
    Reference:
        Jackson, A.S. & Pollock, M.L. (1978). Generalized equations for predicting
        body density of men. British Journal of Nutrition, 40, 497-504.
    """
    s = sum_of_skinfolds_mm
    body_density = (
        1.112
        - (0.00043499 * s)
        + (0.00000055 * s * s)
        - (0.00028826 * age_years)
    )

    logger.info(
        f"Pollock 7-fold calculation: "
        f"sum_skinfolds={s}mm, age={age_years}, "
        f"body_density={body_density:.6f} g/cm³"
    )

    return round(body_density, 6)


def body_density_to_fat_percent(body_density: float) -> float:
    """
    Convert body density to body fat percentage using the Siri equation.
    
    The Siri equation (1961) is the most commonly used formula for this conversion.
    
    Formula:
        Body Fat % = (495 / Body Density) - 450
    
    Args:
        body_density: Body density in g/cm³ (from Pollock or other method)
    
    Returns:
        Body fat percentage (e.g., 15.5 means 15.5%)
    
    Reference:
        Siri, W.E. (1961). Body composition from fluid spaces and density:
        Analysis of methods. In J. Brozek & A. Henschel (Eds.), Techniques for
        Measuring Body Composition (pp. 223-224). Washington, DC: National
        Academy of Sciences.
    """
    if body_density <= 0:
        logger.warning(f"Invalid body density: {body_density}. Returning 0.")
        return 0.0

    fat_percent = (495.0 / body_density) - 450.0

    # Clamp to reasonable range (0% to 60%)
    fat_percent = max(0.0, min(fat_percent, 60.0))

    logger.info(
        f"Siri equation: density={body_density:.6f} -> fat={fat_percent:.2f}%"
    )

    return round(fat_percent, 2)


def calculate_body_fat_from_skinfolds(
    chest: float,
    axillary: float,
    triceps: float,
    subscapular: float,
    suprailiac: float,
    abdominal: float,
    thigh: float,
    age_years: int = 25,
) -> dict:
    """
    Complete body fat calculation from 7 skinfold measurements.
    
    This is the main entry point for the body fat calculation service.
    It takes the 7 individual skinfold measurements, sums them up,
    calculates body density, and then converts to body fat percentage.
    
    Args:
        chest: Chest skinfold in mm
        axillary: Mid-axillary skinfold in mm
        triceps: Triceps skinfold in mm
        subscapular: Subscapular skinfold in mm
        suprailiac: Suprailiac skinfold in mm
        abdominal: Abdominal skinfold in mm
        thigh: Thigh skinfold in mm
        age_years: Age of the subject (default: 25)
    
    Returns:
        dict with keys:
            - sum_of_skinfolds: float (total mm)
            - body_density: float (g/cm³)
            - body_fat_percent: float (%)
    """
    # Sum all 7 skinfold sites
    sum_of_skinfolds = (
        chest + axillary + triceps + subscapular
        + suprailiac + abdominal + thigh
    )

    # Calculate body density using the Pollock equation
    body_density = calculate_body_density_pollock_7(sum_of_skinfolds, age_years)

    # Convert body density to body fat % using the Siri equation
    body_fat_percent = body_density_to_fat_percent(body_density)

    return {
        "sum_of_skinfolds": round(sum_of_skinfolds, 2),
        "body_density": body_density,
        "body_fat_percent": body_fat_percent,
    }
