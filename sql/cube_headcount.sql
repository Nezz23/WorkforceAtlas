-- On-board headcount at the segment grain, one employment snapshot. Pay counts only numeric (unredacted) values.
select _month as month, department_code, agency_code, occupational_group_code as occ_group,
       grade_band(pay_plan_code, grade) as grade_band, los_band(num(length_of_service_years)) as los_band,
       coalesce(age_bracket, 'Unknown') as age_bracket, is_supervisor(supervisory_status_code) as supervisor,
       count(*) as n,
       sum(num(length_of_service_years)) as los_years,
       count(num(annualized_adjusted_basic_pay)) as pay_n,
       sum(num(annualized_adjusted_basic_pay)) as pay_sum
from src
group by all
