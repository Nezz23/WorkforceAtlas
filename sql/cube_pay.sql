-- Pay structure, one employment snapshot. n counts every record; pay_* only unredacted numeric pay.
-- Redacted GS records keep grade and step, so derived base pay = n - pay_n records times the GS table rate.
select _month as month, department_code, agency_code, occupational_group_code as occ_group,
       pay_plan_code as pay_plan, grade, step_or_rate_type_code as step,
       count(*) as n,
       count(num(annualized_adjusted_basic_pay)) as pay_n,
       sum(num(annualized_adjusted_basic_pay)) as pay_sum
from src
group by all
