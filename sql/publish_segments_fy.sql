-- Separation rates by fiscal year and workforce segment, government-wide ('ALL') and per department.
-- Fiscal year t runs October t-1 to September t. Exposure = mean of the 12 monthly headcounts in the year.
-- Transfers are excluded at both levels here, so a segment rate is comparable across scopes.
with hc as (
    select *, month // 100 + (month % 100 >= 10)::int as fy from (select * replace (nullif(department_code, 'No Data Reported') as department_code) from read_parquet('data/warehouse/headcount/*.parquet'))
),
sep as (
    select s.*, s.month // 100 + (s.month % 100 >= 10)::int as fy, r.voluntary
    from (select * replace (nullif(department_code, 'No Data Reported') as department_code) from read_parquet('data/warehouse/separations/*.parquet')) s
    join read_csv('ref/separation_categories.csv') r on r.code = s.category
    where r.government_wide
),
dims as (
    select fy, month, department_code, 'los_band' as dimension, los_band as level, n, 0 as s, 0 as v, 0 as d from hc
    union all select fy, month, department_code, 'age_bracket', age_bracket, n, 0, 0, 0 from hc
    union all select fy, month, department_code, 'grade_band', grade_band, n, 0, 0, 0 from hc
    union all select fy, month, department_code, 'supervisor', case when supervisor then 'Supervisor or manager' else 'Non-supervisory' end, n, 0, 0, 0 from hc
    union all select fy, month, department_code, 'los_band', los_band, 0, n, n * voluntary::int, n * drp::int from sep
    union all select fy, month, department_code, 'age_bracket', age_bracket, 0, n, n * voluntary::int, n * drp::int from sep
    union all select fy, month, department_code, 'grade_band', grade_band, 0, n, n * voluntary::int, n * drp::int from sep
    union all select fy, month, department_code, 'supervisor', case when supervisor then 'Supervisor or manager' else 'Non-supervisory' end, 0, n, n * voluntary::int, n * drp::int from sep
),
months as (select fy, count(distinct month) as n_months from hc group by fy)
select d.fy, case when grouping(d.department_code) = 1 then 'ALL' else coalesce(d.department_code, 'UNKNOWN') end as scope, d.dimension, d.level,
       sum(d.n) / any_value(m.n_months) as avg_headcount,
       sum(d.s) as separations, sum(d.v) as voluntary, sum(d.d) as drp, any_value(m.n_months) as n_months
from dims d join months m using (fy)
group by grouping sets ((d.fy, d.dimension, d.level), (d.fy, d.department_code, d.dimension, d.level))
