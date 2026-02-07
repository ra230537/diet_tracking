"""
Tests for the Bulking Coach Service — Floating Anchor & Calories-First Strategy
=================================================================================
Uses an in-memory SQLite database (aiosqlite) for fast, isolated testing.

Test matrix:
  1. Regular case:  Logs 1 week apart → normal weekly_rate calculation
  2. Irregular case: Logs 3 weeks apart → division by 3 (time-normalized)
  3. Loss case:      Weight loss → +500 kcal, +125g carbs
  4. Slow gain case: Small gain → +250 kcal, +62.5g carbs
  5. Optimal case:   Good gain → no adjustment
  6. High velocity:  Too fast → −250 kcal, −62.5g carbs
  7. Insufficient data: Less than 2 distinct periods → ValueError
"""

import pytest
import pytest_asyncio
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import event

from app.core.database import Base
from app.models import BodyLog, DietPlan
from app.services.coach import (
    check_stagnation,
    _classify_weekly_rate,
    RATE_MIN_FLOOR,
    RATE_MAX_CEILING,
)


# ── Fixtures ────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def engine():
    """Create an in-memory SQLite async engine for testing."""
    eng = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    # SQLite doesn't enforce FK by default; enable it
    @event.listens_for(eng.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield eng

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db(engine):
    """Provide a fresh async session for each test."""
    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


# ── Helper to seed body logs ────────────────────────────────────

async def _seed_logs(
    db: AsyncSession,
    weights_with_dates: list[tuple[date, float]],
    user_id: str = "default_user",
):
    """
    Insert BodyLog records for the given (date, weight_kg) pairs.
    """
    for d, w in weights_with_dates:
        log = BodyLog(date=d, user_id=user_id, weight_kg=w)
        db.add(log)
    await db.commit()


async def _seed_diet_plan(
    db: AsyncSession,
    calories: float = 3000.0,
    carbs: float = 400.0,
    user_id: str = "default_user",
):
    """Insert an active DietPlan."""
    plan = DietPlan(
        user_id=user_id,
        target_calories=calories,
        target_protein=200.0,
        target_carbs=carbs,
        target_fat=80.0,
        is_active=True,
    )
    db.add(plan)
    await db.commit()


# ── Unit Tests for _classify_weekly_rate ────────────────────────

class TestClassifyWeeklyRate:
    """Test the pure function that classifies weekly rate into states."""

    def test_weight_loss(self):
        """Negative rate → weight_loss state, +500 kcal, +125g carbs."""
        state, msg, kcal, carbs = _classify_weekly_rate(
            weekly_rate=-0.3, monthly_projection=-1.2
        )
        assert state == "weight_loss"
        assert kcal == 500.0
        assert carbs == 125.0

    def test_slow_gain(self):
        """Rate between 0 and 0.125 → slow_gain, +250 kcal, +62.5g carbs."""
        state, msg, kcal, carbs = _classify_weekly_rate(
            weekly_rate=0.05, monthly_projection=0.2
        )
        assert state == "slow_gain"
        assert kcal == 250.0
        assert carbs == 62.5

    def test_slow_gain_at_zero(self):
        """Rate exactly 0 → slow_gain."""
        state, msg, kcal, carbs = _classify_weekly_rate(
            weekly_rate=0.0, monthly_projection=0.0
        )
        assert state == "slow_gain"
        assert kcal == 250.0
        assert carbs == 62.5

    def test_optimal_at_lower_bound(self):
        """Rate exactly 0.125 → optimal, no change."""
        state, msg, kcal, carbs = _classify_weekly_rate(
            weekly_rate=0.125, monthly_projection=0.5
        )
        assert state == "optimal"
        assert kcal == 0.0
        assert carbs == 0.0

    def test_optimal_at_upper_bound(self):
        """Rate exactly 0.375 → optimal, no change."""
        state, msg, kcal, carbs = _classify_weekly_rate(
            weekly_rate=0.375, monthly_projection=1.5
        )
        assert state == "optimal"
        assert kcal == 0.0
        assert carbs == 0.0

    def test_optimal_middle(self):
        """Rate 0.25 → optimal, no change."""
        state, msg, kcal, carbs = _classify_weekly_rate(
            weekly_rate=0.25, monthly_projection=1.0
        )
        assert state == "optimal"
        assert kcal == 0.0
        assert carbs == 0.0

    def test_high_velocity(self):
        """Rate > 0.375 → high_velocity, −250 kcal, −62.5g carbs."""
        state, msg, kcal, carbs = _classify_weekly_rate(
            weekly_rate=0.5, monthly_projection=2.0
        )
        assert state == "high_velocity"
        assert kcal == -250.0
        assert carbs == -62.5


# ── Integration Tests with check_stagnation ────────────────────

class TestCheckStagnationRegular:
    """Case: Logs 1 week apart — normal weekly_rate calculation."""

    @pytest.mark.asyncio
    async def test_regular_optimal_gain(self, db: AsyncSession):
        """
        Previous window: ~75kg, Current window: ~75.25kg.
        1 week apart → weekly_rate ≈ 0.25 → optimal.
        """
        today = date(2026, 2, 7)
        await _seed_diet_plan(db)

        logs = [
            # Current window (last 7 days)
            (today, 75.3),
            (today - timedelta(days=2), 75.2),
            (today - timedelta(days=5), 75.25),
            # Previous anchor: 8 days ago (just outside the 7-day window)
            (today - timedelta(days=8), 75.0),
            (today - timedelta(days=10), 74.95),
            (today - timedelta(days=12), 75.05),
        ]
        await _seed_logs(db, logs)

        result = await check_stagnation(db)

        assert result["analysis_state"] == "optimal"
        assert not result["is_stagnating"]
        assert result["weekly_rate"] > 0
        assert result["monthly_projection"] > 0
        assert result["weeks_elapsed"] >= 1.0


class TestCheckStagnationIrregular:
    """Case: Logs 3 weeks apart — ensures division by ~3 works."""

    @pytest.mark.asyncio
    async def test_irregular_three_weeks_apart(self, db: AsyncSession):
        """
        Previous anchor 21 days ago → weeks_elapsed ≈ 3.
        Total gain of 0.75 kg over 3 weeks → weekly_rate ≈ 0.25 → optimal.
        """
        today = date(2026, 2, 7)
        await _seed_diet_plan(db)

        logs = [
            # Current window
            (today, 76.0),
            (today - timedelta(days=3), 75.9),
            # Previous anchor: 21 days ago (outside the 7-day window)
            (today - timedelta(days=21), 75.2),
            (today - timedelta(days=23), 75.15),
        ]
        await _seed_logs(db, logs)

        result = await check_stagnation(db)

        # weeks_elapsed should be ~3.0
        assert result["weeks_elapsed"] >= 2.5
        assert result["weeks_elapsed"] <= 3.5
        # With ~0.75 kg over 3 weeks → ~0.25 kg/week → optimal
        assert result["analysis_state"] == "optimal"
        assert not result["is_stagnating"]


class TestCheckStagnationLoss:
    """Case: Weight loss detected → +500 kcal suggestion."""

    @pytest.mark.asyncio
    async def test_weight_loss_suggests_500_kcal(self, db: AsyncSession):
        """Losing weight → +500 kcal, +125g carbs."""
        today = date(2026, 2, 7)
        await _seed_diet_plan(db, calories=3000, carbs=400)

        logs = [
            # Current window: lower weight
            (today, 74.0),
            (today - timedelta(days=3), 74.2),
            # Previous anchor: higher weight
            (today - timedelta(days=10), 75.0),
            (today - timedelta(days=14), 75.1),
        ]
        await _seed_logs(db, logs)

        result = await check_stagnation(db)

        assert result["analysis_state"] == "weight_loss"
        assert result["is_stagnating"] is True
        assert result["weekly_rate"] < 0
        assert result["suggested_calorie_adjustment"] == 500.0
        assert result["suggested_carb_adjustment_g"] == 125.0
        assert result["suggested_calories"] == 3500.0
        assert result["suggested_carbs_g"] == 525.0


class TestCheckStagnationSlow:
    """Case: Slow gain → +250 kcal suggestion."""

    @pytest.mark.asyncio
    async def test_slow_gain_suggests_250_kcal(self, db: AsyncSession):
        """Gaining too slowly → +250 kcal, +62.5g carbs."""
        today = date(2026, 2, 7)
        await _seed_diet_plan(db, calories=3000, carbs=400)

        logs = [
            # Current window: very slight gain
            (today, 75.1),
            (today - timedelta(days=3), 75.08),
            # Previous anchor ~10 days ago
            (today - timedelta(days=10), 75.0),
            (today - timedelta(days=12), 74.98),
        ]
        await _seed_logs(db, logs)

        result = await check_stagnation(db)

        assert result["analysis_state"] == "slow_gain"
        assert result["is_stagnating"] is True
        assert 0 <= result["weekly_rate"] < RATE_MIN_FLOOR
        assert result["suggested_calorie_adjustment"] == 250.0
        assert result["suggested_carb_adjustment_g"] == 62.5
        assert result["suggested_calories"] == 3250.0
        assert result["suggested_carbs_g"] == 462.5


class TestCheckStagnationFast:
    """Case: High velocity → −250 kcal suggestion."""

    @pytest.mark.asyncio
    async def test_high_velocity_suggests_minus_250_kcal(self, db: AsyncSession):
        """Gaining too fast → −250 kcal, −62.5g carbs."""
        today = date(2026, 2, 7)
        await _seed_diet_plan(db, calories=3000, carbs=400)

        logs = [
            # Current window: big jump
            (today, 77.0),
            (today - timedelta(days=3), 76.8),
            # Previous anchor ~8 days ago
            (today - timedelta(days=8), 75.5),
            (today - timedelta(days=10), 75.4),
        ]
        await _seed_logs(db, logs)

        result = await check_stagnation(db)

        assert result["analysis_state"] == "high_velocity"
        assert result["is_stagnating"] is True
        assert result["weekly_rate"] > RATE_MAX_CEILING
        assert result["suggested_calorie_adjustment"] == -250.0
        assert result["suggested_carb_adjustment_g"] == -62.5
        assert result["suggested_calories"] == 2750.0
        assert result["suggested_carbs_g"] == 337.5


class TestCheckStagnationInsufficientData:
    """Case: Not enough data → ValueError raised."""

    @pytest.mark.asyncio
    async def test_no_logs_raises_error(self, db: AsyncSession):
        """Zero logs → ValueError."""
        with pytest.raises(ValueError, match="Dados insuficientes"):
            await check_stagnation(db)

    @pytest.mark.asyncio
    async def test_one_log_raises_error(self, db: AsyncSession):
        """Single log → ValueError (need at least 2)."""
        today = date(2026, 2, 7)
        await _seed_logs(db, [(today, 75.0)])

        with pytest.raises(ValueError, match="Dados insuficientes"):
            await check_stagnation(db)

    @pytest.mark.asyncio
    async def test_all_logs_in_same_window_raises_error(self, db: AsyncSession):
        """
        Multiple logs but all within the same 7-day window →
        no previous anchor found → ValueError.
        """
        today = date(2026, 2, 7)
        logs = [
            (today, 75.0),
            (today - timedelta(days=2), 74.9),
            (today - timedelta(days=5), 74.8),
        ]
        await _seed_logs(db, logs)

        with pytest.raises(ValueError, match="antes da janela atual"):
            await check_stagnation(db)


class TestMonthlyProjection:
    """Ensure monthly_projection = weekly_rate * 4 is always correct."""

    @pytest.mark.asyncio
    async def test_monthly_projection_is_4x_weekly_rate(self, db: AsyncSession):
        """The monthly projection should always be weekly_rate * 4."""
        today = date(2026, 2, 7)
        await _seed_diet_plan(db)

        logs = [
            (today, 76.0),
            (today - timedelta(days=4), 75.8),
            (today - timedelta(days=14), 75.0),
            (today - timedelta(days=16), 74.9),
        ]
        await _seed_logs(db, logs)

        result = await check_stagnation(db)

        expected_monthly = round(result["weekly_rate"] * 4, 3)
        assert result["monthly_projection"] == expected_monthly


class TestWeeksElapsedMinimum:
    """Ensure weeks_elapsed is always at least 1 even when anchors are close."""

    @pytest.mark.asyncio
    async def test_close_anchors_floor_to_1_week(self, db: AsyncSession):
        """
        When the previous anchor is just outside the 7-day window (8 days ago),
        weeks_elapsed should be around 1.1 (8/7), which is > 1.
        """
        today = date(2026, 2, 7)
        await _seed_diet_plan(db)

        logs = [
            (today, 75.5),
            (today - timedelta(days=8), 75.0),
        ]
        await _seed_logs(db, logs)

        result = await check_stagnation(db)

        assert result["weeks_elapsed"] >= 1.0


class TestAlreadyAdjusted:
    """
    Ensure that after applying a suggestion, re-running check_stagnation
    returns 'awaiting data' and does NOT suggest again until new body logs arrive.
    """

    @pytest.mark.asyncio
    async def test_already_adjusted_blocks_repeat_suggestion(self, db: AsyncSession):
        """
        Simulate: check → apply → check again (no new body log).
        The second check should return is_stagnating=False with 'Ajuste já realizado'.
        """
        from app.services.coach import apply_suggestion

        today = date(2026, 2, 7)
        await _seed_diet_plan(db, calories=3000, carbs=400)

        # Slow gain scenario (will trigger +250 kcal suggestion)
        logs = [
            (today, 75.1),
            (today - timedelta(days=3), 75.08),
            (today - timedelta(days=10), 75.0),
            (today - timedelta(days=12), 74.98),
        ]
        await _seed_logs(db, logs)

        # First check — should suggest adjustment
        result1 = await check_stagnation(db)
        assert result1["is_stagnating"] is True
        assert result1["analysis_state"] == "slow_gain"
        assert result1["suggested_calorie_adjustment"] == 250.0

        # Apply the suggestion (with fingerprint)
        await apply_suggestion(
            db=db,
            user_id="default_user",
            calorie_adjustment=250.0,
            carb_adjustment_g=62.5,
            w_curr=result1["current_week_avg_weight"],
            w_prev=result1["previous_week_avg_weight"],
        )

        # Second check — should be blocked (same weight data)
        result2 = await check_stagnation(db)
        assert result2["is_stagnating"] is False
        assert "Ajuste já realizado" in result2["message"]
        assert result2["suggested_calorie_adjustment"] is None

    @pytest.mark.asyncio
    async def test_new_body_log_after_adjustment_allows_new_suggestion(self, db: AsyncSession):
        """
        Simulate: check → apply → add new body log (changes W_curr) → check again.
        The third check should be allowed to suggest again because W_curr changed.
        """
        from app.services.coach import apply_suggestion

        today = date(2026, 2, 7)
        await _seed_diet_plan(db, calories=3000, carbs=400)

        logs = [
            (today, 75.1),
            (today - timedelta(days=3), 75.08),
            (today - timedelta(days=10), 75.0),
            (today - timedelta(days=12), 74.98),
        ]
        await _seed_logs(db, logs)

        # First check + apply
        result1 = await check_stagnation(db)
        assert result1["is_stagnating"] is True

        await apply_suggestion(
            db=db,
            user_id="default_user",
            calorie_adjustment=250.0,
            carb_adjustment_g=62.5,
            w_curr=result1["current_week_avg_weight"],
            w_prev=result1["previous_week_avg_weight"],
        )

        # Add a NEW body log — this changes W_curr (new weight in the window)
        new_log = BodyLog(
            date=today + timedelta(days=1),
            user_id="default_user",
            weight_kg=75.5,  # Different weight → changes W_curr average
        )
        db.add(new_log)
        await db.commit()

        # Third check — W_curr changed due to new data, should not be blocked
        result3 = await check_stagnation(db)
        assert "Ajuste já realizado" not in result3["message"]

    @pytest.mark.asyncio
    async def test_deleted_body_log_invalidates_adjustment(self, db: AsyncSession):
        """
        Simulate: check → apply → delete a body log → check again.
        Deleting a log changes W_curr/W_prev, so the adjustment becomes stale.
        """
        from app.services.coach import apply_suggestion

        today = date(2026, 2, 7)
        await _seed_diet_plan(db, calories=3000, carbs=400)

        logs = [
            (today, 75.1),
            (today - timedelta(days=3), 75.08),
            (today - timedelta(days=10), 75.0),
            (today - timedelta(days=12), 74.98),
        ]
        await _seed_logs(db, logs)

        # First check + apply
        result1 = await check_stagnation(db)
        assert result1["is_stagnating"] is True

        await apply_suggestion(
            db=db,
            user_id="default_user",
            calorie_adjustment=250.0,
            carb_adjustment_g=62.5,
            w_curr=result1["current_week_avg_weight"],
            w_prev=result1["previous_week_avg_weight"],
        )

        # Delete one of the current window logs (this changes W_curr)
        from sqlalchemy import select as sel
        stmt = sel(BodyLog).where(BodyLog.date == today).limit(1)
        res = await db.execute(stmt)
        log_to_delete = res.scalar_one()
        await db.delete(log_to_delete)
        await db.commit()

        # Check again — W_curr changed because a log was deleted
        result3 = await check_stagnation(db)
        assert "Ajuste já realizado" not in result3["message"]
