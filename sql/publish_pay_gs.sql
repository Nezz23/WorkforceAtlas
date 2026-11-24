-- General Schedule pay by month, department ('ALL' = government-wide) and grade.
-- observed: unredacted annualized adjusted basic pay (includes locality and special rates).
-- derived:  hidden-pay GS records priced at the OPM GS base table for their grade, step and calendar year.
--           Base pay only, locality excluded. Records whose step has no table rate (step 00, invalid) stay hidden.
with gs as (select * from read_csv('ref/gs_base_pay.csv', types = {'grade': 'varchar', 'step': 'varchar'})),
p as (
    select p.*, gs.annual_rate
    from (select * replace (nullif(department_code, 'No Data Reported') as department_code) from read_parquet('data/warehouse/pay/*.parquet')) p
    left join gs on gs.year = p.month // 100 and gs.grade = p.grade and gs.step = p.step
    where p.pay_plan = 'GS'
)
select month, case when grouping(department_code) = 1 then 'ALL' else coalesce(department_code, 'UNKNOWN') end as department_code,
       case when grouping(grade) = 1 then 'ALL' else coalesce(grade, 'UNKNOWN') end as grade,
       sum(n) as n,
       sum(pay_n) as observed_n,
       sum(pay_sum) as observed_sum,
       coalesce(sum(n - pay_n) filter (where annual_rate is not null), 0) as derived_n,
       sum((n - pay_n) * annual_rate) as derived_base_sum,
       -- validation: observed pay vs the base rate of the same records
       sum(pay_sum) filter (where annual_rate is not null) as observed_sum_priced,
       sum(pay_n * annual_rate) as base_of_observed_sum
from p
group by grouping sets ((month, department_code, grade), (month, grade), (month, department_code), (month))
