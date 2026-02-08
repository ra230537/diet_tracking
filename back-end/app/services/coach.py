"""
Bulking Coach Service — Time-Normalized Weight Analysis & Calories-First Strategy
===================================================================================
This service implements the "Bulking Coach" algorithm that monitors
the user's weight progress using a **Floating Anchor** approach,
robust to irregular logging habits (any gap between measurements).

ALGORITHM:
  A. Floating Anchor — Dynamic Period Identification:
     1. T_curr = date of the absolute latest BodyLog entry.
     2. Current Window = [T_curr − 7d, T_curr] → W_curr = mean weight.
     3. T_prev = most recent BodyLog strictly before the Current Window.
     4. Previous Window = [T_prev − 7d, T_prev] → W_prev = mean weight.

  B. Normalized Rate Calculation:
     - weeks_elapsed = (T_curr − T_prev).days / 7   (min 1)
     - weekly_rate = (W_curr − W_prev) / weeks_elapsed

  C. Tri-State Analysis (Calories-First):
     Target: 0.5 – 1.5 kg/month ⟹ 0.125 – 0.375 kg/week
     1. Loss          (rate < 0):       +500 kcal, +125 g carbs
     2. Slow Gain     (0 ≤ rate < 0.125): +250 kcal, +62.5 g carbs
     3. Optimal       (0.125 ≤ rate ≤ 0.375): no change
     4. High Velocity (rate > 0.375):  −250 kcal, −62.5 g carbs

  D. Stop Condition — Waist vs Arm:
     If waist grew > 0.5 cm AND arm grew ≤ 0.1 cm → suggest cutting

  E. Body Fat Ceiling:
     If current body_fat > 20% → suggest cutting
"""

import logging
from datetime import date, datetime, timedelta, timezone
from statistics import mean

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BodyLog, DietPlan

logger = logging.getLogger(__name__)

# ── Thresholds ──
WINDOW_DAYS = 6

# Monthly target: 0.5 – 1.5 kg/month  →  weekly boundaries
RATE_MIN_FLOOR = 0.125      # kg/week  (0.5 kg/month ÷ 4)
RATE_MAX_CEILING = 0.375    # kg/week  (1.5 kg/month ÷ 4)

# Stop-condition thresholds
WAIST_GROWTH_THRESHOLD_CM = 0.5
ARM_GROWTH_THRESHOLD_CM = 0.1
BODY_FAT_CEILING_PERCENT = 20.0


async def check_stagnation(
    db: AsyncSession,
    user_id: str = "default_user",
) -> dict:
    """
    Analyze the user's weight history using the Floating Anchor approach.

    Steps:
      A. Dynamic Period Identification (anchor-based windows)
      B. Normalized Rate Calculation (weekly_rate)
      C. Tri-State Calories-First Analysis
      D. Stop Condition: Waist vs Arm
      E. Body Fat Ceiling check

    Returns:
        dict with analysis results, weekly rate, monthly projection,
        calorie/carb adjustment suggestions, and stop-condition flags.

    Raises:
        ValueError: If there isn't enough data for analysis.
    """
    # ── A. Dynamic Period Identification ──

    # A1. Fetch all recent logs, ordered by date desc
    stmt = (
        select(BodyLog)
        .where(BodyLog.user_id == user_id)
        .order_by(BodyLog.date.desc())
        .limit(200)
    )
    result = await db.execute(stmt)
    all_logs = result.scalars().all()

    if len(all_logs) < 2:
        raise ValueError(
            "Dados insuficientes para análise. "
            "É necessário pelo menos 2 registros de peso. "
            f"Encontrados: {len(all_logs)} registros."
        )

    # A2. Anchor = most recent log
    anchor_log = all_logs[0]
    t_curr = anchor_log.date

    # Current window: [T_curr − 7d, T_curr]
    curr_window_start = t_curr - timedelta(days=WINDOW_DAYS)
    curr_window_logs = [
        log for log in all_logs
        if curr_window_start <= log.date <= t_curr
    ]
    w_curr = mean([log.weight_kg for log in curr_window_logs])

    # A3. Find the most recent log strictly before the current window
    prev_anchor_log = None
    for log in all_logs:
        if log.date < curr_window_start:
            prev_anchor_log = log
            break

    if prev_anchor_log is None:
        raise ValueError(
            "Dados insuficientes para análise normalizada. "
            "É necessário pelo menos um registro antes da janela atual "
            f"(antes de {curr_window_start}). Continue registrando seu peso."
        )

    t_prev = prev_anchor_log.date

    # A4. Previous window: [T_prev − 7d, T_prev]
    prev_window_start = t_prev - timedelta(days=WINDOW_DAYS)
    prev_window_logs = [
        log for log in all_logs
        if prev_window_start <= log.date <= t_prev
    ]
    w_prev = mean([log.weight_kg for log in prev_window_logs])

    # ── B. Normalized Rate Calculation ──
    days_between = (t_curr - t_prev).days
    weeks_elapsed = max(days_between / 7, 1.0)  # min 1 to avoid division by zero
    weekly_rate = (w_curr - w_prev) / weeks_elapsed
    monthly_projection = weekly_rate * 4

    logger.info(
        f"Coach analysis for user '{user_id}': "
        f"T_curr={t_curr} (W_curr={w_curr:.2f}kg, {len(curr_window_logs)} logs), "
        f"T_prev={t_prev} (W_prev={w_prev:.2f}kg, {len(prev_window_logs)} logs), "
        f"weeks_elapsed={weeks_elapsed:.1f}, weekly_rate={weekly_rate:.3f} kg/week, "
        f"monthly_projection={monthly_projection:.3f} kg/month"
    )

    # ── Fetch active plan ──
    plan_stmt = (
        select(DietPlan)
        .where(DietPlan.user_id == user_id)
        .where(DietPlan.is_active == True)
    )
    plan_result = await db.execute(plan_stmt)
    active_plan = plan_result.scalar_one_or_none()

    # ── Check if already adjusted ──
    # We store a fingerprint (W_curr, W_prev rounded to 2 decimals) when an
    # adjustment is applied. If the current analysis produces the SAME weight
    # averages, the underlying data hasn't changed → skip repeated suggestion.
    # If ANY body log was added, deleted, or edited, the averages will change
    # and the adjustment is considered stale → allow new suggestion.
    already_adjusted = False
    if active_plan and active_plan.last_coach_adjustment_at:
        saved_w_curr = getattr(active_plan, "last_coach_w_curr", None)
        saved_w_prev = getattr(active_plan, "last_coach_w_prev", None)

        if saved_w_curr is not None and saved_w_prev is not None:
            # Compare rounded values to avoid floating-point noise
            data_unchanged = (
                round(w_curr, 2) == round(saved_w_curr, 2)
                and round(w_prev, 2) == round(saved_w_prev, 2)
            )
            if data_unchanged:
                already_adjusted = True
                logger.info(
                    f"Coach already adjusted for W_curr={saved_w_curr}, "
                    f"W_prev={saved_w_prev} (data unchanged). "
                    f"Skipping suggestion until weight data changes."
                )

    # ── C. Tri-State Calories-First Analysis ──
    state, message, calorie_adjustment, carb_adjustment = _classify_weekly_rate(
        weekly_rate=weekly_rate,
        monthly_projection=monthly_projection,
    )

    # ── D. Stop Condition: Waist vs Arm ──
    suggest_cutting = False
    cutting_reasons: list[str] = []

    waist_change, arm_change = await _get_measurement_changes(
        db, user_id, all_logs, curr_window_start, prev_window_start, t_prev
    )
    if waist_change is not None and arm_change is not None:
        if waist_change > WAIST_GROWTH_THRESHOLD_CM and arm_change <= ARM_GROWTH_THRESHOLD_CM:
            suggest_cutting = True
            cutting_reasons.append(
                f"🛑 Stop Trigger: Cintura cresceu +{waist_change:.1f}cm "
                f"mas braço apenas +{arm_change:.1f}cm. "
                f"Eficiência do bulk caiu. Recomendado: Iniciar Cutting."
            )

    # ── E. Body Fat Ceiling ──
    current_body_fat = _get_latest_body_fat(all_logs)
    if current_body_fat is not None and current_body_fat > BODY_FAT_CEILING_PERCENT:
        suggest_cutting = True
        cutting_reasons.append(
            f"🛑 Limite de gordura corporal ({BODY_FAT_CEILING_PERCENT}%) atingido "
            f"(atual: {current_body_fat:.1f}%). Ambiente hormonal favorece acúmulo de gordura. "
            f"Recomendado: Iniciar Cutting."
        )

    # ── Build result ──
    current_calories = active_plan.target_calories if active_plan else 0
    current_carbs_total = active_plan.target_carbs if active_plan else 0
    anchor_weight = w_curr

    suggested_calories = round(current_calories + calorie_adjustment, 1)
    suggested_carbs_total = round(current_carbs_total + carb_adjustment, 1)
    current_carbs_per_kg = round(current_carbs_total / anchor_weight, 2) if anchor_weight > 0 else 0
    suggested_carbs_per_kg = round(suggested_carbs_total / anchor_weight, 2) if anchor_weight > 0 else 0

    result_data = {
        "current_week_avg_weight": round(w_curr, 2),
        "previous_week_avg_weight": round(w_prev, 2),
        "weight_change_kg": round(w_curr - w_prev, 2),
        "anchor_date": str(t_curr),
        "anchor_weight_kg": round(anchor_log.weight_kg, 2),
        "weekly_rate": round(weekly_rate, 3),
        "monthly_projection": round(monthly_projection, 3),
        "weeks_elapsed": round(weeks_elapsed, 1),
        "analysis_state": state,
        "suggest_cutting": suggest_cutting,
        "cutting_reasons": cutting_reasons,
        "current_body_fat_percent": round(current_body_fat, 1) if current_body_fat is not None else None,
        "waist_change_cm": round(waist_change, 1) if waist_change is not None else None,
        "arm_change_cm": round(arm_change, 1) if arm_change is not None else None,
    }

    # If already adjusted → "awaiting new data"
    # Block all states that suggest changes (increase or decrease)
    if already_adjusted and state in ("weight_loss", "slow_gain", "high_velocity"):
        result_data["is_stagnating"] = False
        result_data["message"] = (
            "Ajuste já realizado! Aguardando novos registros de peso para "
            "avaliar o impacto. Continue seguindo o plano atualizado e "
            "registre seu peso regularmente."
        )
        result_data.update(_empty_suggestion_fields())
        return result_data

    # Populate suggestion fields based on state
    needs_adjustment = state in ("weight_loss", "slow_gain", "high_velocity")
    result_data["is_stagnating"] = needs_adjustment
    result_data["message"] = message

    if needs_adjustment and calorie_adjustment != 0:
        result_data.update({
            "suggested_calorie_adjustment": round(calorie_adjustment, 1),
            "suggested_carb_adjustment_g": round(carb_adjustment, 1),
            "current_carbs_g": round(current_carbs_total, 1),
            "current_carbs_per_kg": current_carbs_per_kg,
            "suggested_carbs_g": suggested_carbs_total,
            "suggested_carbs_per_kg": suggested_carbs_per_kg,
            "current_calories": round(current_calories, 1),
            "suggested_calories": suggested_calories,
        })

        if active_plan:
            result_data["new_target_calories"] = suggested_calories
            result_data["new_target_carbs"] = suggested_carbs_total
        else:
            result_data["new_target_calories"] = None
            result_data["new_target_carbs"] = None
    else:
        result_data.update(_empty_suggestion_fields())

    return result_data


def _classify_weekly_rate(
    weekly_rate: float,
    monthly_projection: float,
) -> tuple[str, str, float, float]:
    """
    Classify the weekly rate into one of four states using the
    Calories-First strategy.

    Returns:
        (state, message, calorie_adjustment, carb_adjustment)

    Boundaries (monthly target: 0.5 – 1.5 kg):
        - Loss:          rate < 0          → +500 kcal, +125 g carbs
        - Slow Gain:     0 ≤ rate < 0.125  → +250 kcal, +62.5 g carbs
        - Optimal:       0.125 ≤ rate ≤ 0.375 → no change
        - High Velocity: rate > 0.375      → −250 kcal, −62.5 g carbs
    """
    if weekly_rate < 0:
        # Case 1A: Weight Loss — aggressive surplus
        return (
            "weight_loss",
            f"⚠️ Perda de peso detectada (Taxa: {weekly_rate:.3f} kg/semana). "
            f"Adicionando +500 kcal (+125g de carboidrato) para reverter a perda e atingir a meta mensal.",
            500.0,
            125.0,
        )

    elif weekly_rate < RATE_MIN_FLOOR:
        # Case 1B: Slow Gain — moderate surplus
        return (
            "slow_gain",
            f"⚠️ Ganho muito lento (Taxa: {weekly_rate:.3f} kg/semana). "
            f"Adicionando +250 kcal (+62.5g de carboidrato) para atingir a meta mensal.",
            250.0,
            62.5,
        )

    elif weekly_rate <= RATE_MAX_CEILING:
        # Case 2: Optimal Zone — no change
        return (
            "optimal",
            f"✅ Zona Perfeita! Você está ganhando aprox. "
            f"{monthly_projection:.2f} kg/mês. Continue firme!",
            0.0,
            0.0,
        )

    else:
        # Case 3: High Velocity — reduce calories
        return (
            "high_velocity",
            f"⚠️ Ganhando rápido demais ({monthly_projection:.2f} kg/mês). "
            f"Reduzindo 250 kcal para minimizar acúmulo de gordura.",
            -250.0,
            -62.5,
        )


async def _get_measurement_changes(
    db: AsyncSession,
    user_id: str,
    all_logs: list[BodyLog],
    curr_window_start: date,
    prev_window_start: date,
    t_prev: date,
) -> tuple[float | None, float | None]:
    """
    Calculate waist and arm circumference changes between the current
    and previous anchor periods.

    Returns (waist_change, arm_change) or (None, None) if data is unavailable.
    """
    # Find the latest log with waist measurement in the current window
    curr_waist = None
    curr_arm = None
    for log in all_logs:
        if log.date >= curr_window_start:
            if curr_waist is None and log.circ_waist is not None:
                curr_waist = log.circ_waist
            if curr_arm is None:
                arm_val = log.circ_arm_contracted_right or log.circ_arm_relaxed_right
                if arm_val is not None:
                    curr_arm = arm_val
        if curr_waist is not None and curr_arm is not None:
            break

    # Find the latest log with waist measurement in the previous window
    prev_waist = None
    prev_arm = None
    for log in all_logs:
        if prev_window_start <= log.date <= t_prev:
            if prev_waist is None and log.circ_waist is not None:
                prev_waist = log.circ_waist
            if prev_arm is None:
                arm_val = log.circ_arm_contracted_right or log.circ_arm_relaxed_right
                if arm_val is not None:
                    prev_arm = arm_val
        if prev_waist is not None and prev_arm is not None:
            break

    if curr_waist is not None and prev_waist is not None:
        waist_change = curr_waist - prev_waist
    else:
        waist_change = None

    if curr_arm is not None and prev_arm is not None:
        arm_change = curr_arm - prev_arm
    else:
        arm_change = None

    return waist_change, arm_change


def _get_latest_body_fat(logs: list[BodyLog]) -> float | None:
    """
    Get the most recent body fat percentage from logs.
    Prefers bio_body_fat_percent (from bioimpedance device).
    """
    for log in logs:
        if log.bio_body_fat_percent is not None:
            return log.bio_body_fat_percent
    return None


def _empty_suggestion_fields() -> dict:
    """Return dict with all suggestion fields set to None."""
    return {
        "suggested_calorie_adjustment": None,
        "suggested_carb_adjustment_g": None,
        "new_target_calories": None,
        "new_target_carbs": None,
        "current_carbs_g": None,
        "current_carbs_per_kg": None,
        "suggested_carbs_g": None,
        "suggested_carbs_per_kg": None,
        "current_calories": None,
        "suggested_calories": None,
    }


async def dismiss_suggestion(
    db: AsyncSession,
    user_id: str,
    w_curr: float,
    w_prev: float,
) -> None:
    """
    Dismiss a coach suggestion without changing the diet plan targets.

    Records the weight fingerprint (w_curr, w_prev) so that
    check_stagnation recognises this data set as already handled
    and won't re-suggest until new body-log data arrives.

    Args:
        db: Async database session
        user_id: The user dismissing the suggestion
        w_curr: Current window average weight from the analysis
        w_prev: Previous window average weight from the analysis

    Raises:
        ValueError: If no active diet plan is found
    """
    stmt = (
        select(DietPlan)
        .where(DietPlan.user_id == user_id)
        .where(DietPlan.is_active == True)
    )
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()

    if not plan:
        raise ValueError(
            f"No active diet plan found for user '{user_id}'. "
            "Please create a diet plan first."
        )

    # Save the fingerprint (same mechanism as apply_suggestion)
    # but do NOT touch target_calories / target_carbs.
    plan.last_coach_adjustment_at = datetime.now(timezone.utc)
    plan.last_coach_w_curr = round(w_curr, 2)
    plan.last_coach_w_prev = round(w_prev, 2)

    await db.commit()

    logger.info(
        f"Dismissed coach suggestion for user '{user_id}': "
        f"fingerprint W_curr={w_curr:.2f}, W_prev={w_prev:.2f} "
        f"(targets unchanged)"
    )


async def apply_suggestion(
    db: AsyncSession,
    user_id: str,
    calorie_adjustment: float,
    carb_adjustment_g: float,
    w_curr: float,
    w_prev: float,
) -> DietPlan:
    """
    Apply a coach suggestion by adjusting the active diet plan's targets.

    This updates the active DietPlan by adding (or subtracting) the suggested
    amounts to the current calorie and carb targets, and records a fingerprint
    (w_curr, w_prev) of the weight data used in the analysis. This fingerprint
    prevents the coach from re-suggesting when no new data has arrived,
    but automatically unlocks when body logs change.

    Args:
        db: Async database session
        user_id: The user whose plan to update
        calorie_adjustment: Calories to add/subtract from the current target
        carb_adjustment_g: Carbs (g) to add/subtract from the current target
        w_curr: Current window average weight from the analysis
        w_prev: Previous window average weight from the analysis

    Returns:
        The updated DietPlan object

    Raises:
        ValueError: If no active diet plan is found
    """
    # Find the active diet plan
    stmt = (
        select(DietPlan)
        .where(DietPlan.user_id == user_id)
        .where(DietPlan.is_active == True)
    )
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()

    if not plan:
        raise ValueError(
            f"No active diet plan found for user '{user_id}'. "
            "Please create a diet plan first."
        )

    # Apply the adjustment (can be positive or negative)
    old_calories = plan.target_calories
    old_carbs = plan.target_carbs

    plan.target_calories = round(plan.target_calories + calorie_adjustment, 1)
    plan.target_carbs = round(plan.target_carbs + carb_adjustment_g, 1)

    # Record the adjustment timestamp and weight fingerprint
    plan.last_coach_adjustment_at = datetime.now(timezone.utc)
    plan.last_coach_w_curr = round(w_curr, 2)
    plan.last_coach_w_prev = round(w_prev, 2)

    # Also store the anchor date for reference
    anchor_stmt = (
        select(BodyLog.date)
        .where(BodyLog.user_id == user_id)
        .order_by(BodyLog.date.desc())
        .limit(1)
    )
    anchor_result = await db.execute(anchor_stmt)
    anchor_date = anchor_result.scalar_one_or_none()
    if anchor_date is not None:
        plan.last_coach_anchor_date = anchor_date

    await db.commit()
    await db.refresh(plan)

    logger.info(
        f"Applied coach suggestion for user '{user_id}': "
        f"calories {old_calories} -> {plan.target_calories} ({calorie_adjustment:+.1f}), "
        f"carbs {old_carbs} -> {plan.target_carbs} ({carb_adjustment_g:+.1f}g), "
        f"fingerprint W_curr={w_curr:.2f}, W_prev={w_prev:.2f}"
    )

    return plan
