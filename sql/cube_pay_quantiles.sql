-- Exact observed-pay quantiles by pay plan and grade, government-wide (department_code 'ALL') and per department.
select any_value(_month) as month, case when grouping(department_code) = 1 then 'ALL' else coalesce(department_code, 'UNKNOWN') end as department_code, pay_plan_code as pay_plan, grade,
       count(*) as n,
       count(num(annualized_adjusted_basic_pay)) as pay_n,
       quantile_cont(num(annualized_adjusted_basic_pay), [0.1, 0.25, 0.5, 0.75, 0.9]) as pay_q
from src
group by grouping sets ((department_code, pay_plan_code, grade), (pay_plan_code, grade))
