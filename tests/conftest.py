"""Hand-made fixture rows (synthetic, not OPM data) shaped like FWD files, for testing the contract and the cubes."""
import pandas as pd
import pytest

BASE = dict(count="1", department_code="AG", department="DEPARTMENT OF AGRICULTURE", agency_code="AG10",
            agency="FOREST SERVICE", occupational_group_code="04", occupational_group="BIOLOGICAL SCIENCES GROUP",
            pay_plan_code="GS", grade="09", step_or_rate_type_code="03", length_of_service_years="4.5",
            age_bracket="30-34", supervisory_status_code="8", annualized_adjusted_basic_pay="70000.00")


def rows(n: int, **over) -> list[dict]:
    return [{**BASE, **over} for _ in range(n)]


@pytest.fixture
def write(tmp_path):
    def _write(name: str, records: list[dict]):
        path = tmp_path / f"{name}.parquet"
        pd.DataFrame(records).astype(str).replace("None", None).to_parquet(path)
        return path
    return _write
