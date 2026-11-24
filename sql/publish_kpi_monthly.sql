-- Monthly KPI counts, government-wide (scope 'ALL') and per department. Rates and intervals are added in Python.
-- Government-wide flows exclude transfers between agencies (they move people, they do not change the workforce);
-- department flows include them. Flows are counted in the month OPM processed them (see late_* columns).
with sep as (
    select s.*, r.kpi_group, r.voluntary, r.government_wide
    from (select * replace (nullif(department_code, 'No Data Reported') as department_code) from read_parquet('data/warehouse/separations/*.parquet')) s
    join read_csv('ref/separation_categories.csv') r on r.code = s.category
),
acc as (
    select a.*, r.kpi_group, r.government_wide
    from (select * replace (nullif(department_code, 'No Data Reported') as department_code) from read_parquet('data/warehouse/accessions/*.parquet')) a
    join read_csv('ref/accession_categories.csv') r on r.code = a.category
),
hc_w as (
    select month, case when grouping(department_code) = 1 then 'ALL' else coalesce(department_code, 'UNKNOWN') end as scope,
           sum(n) as headcount, sum(pay_n) as pay_n
    from (select * replace (nullif(department_code, 'No Data Reported') as department_code) from read_parquet('data/warehouse/headcount/*.parquet'))
    group by grouping sets ((month), (month, department_code))
),
sep_w as (
    select month, scope,
           sum(n) as separations,
           sum(n) filter (where voluntary) as sep_voluntary,
           sum(n) filter (where drp) as sep_drp,
           sum(n) filter (where drp and kpi_group = 'quit') as sep_drp_quit,
           sum(n) filter (where drp and kpi_group = 'retirement') as sep_drp_retirement,
           sum(n) filter (where kpi_group = 'quit') as sep_quit,
           sum(n) filter (where kpi_group = 'retirement') as sep_retirement,
           sum(n) filter (where kpi_group = 'retirement_other') as sep_retirement_other,
           sum(n) filter (where kpi_group = 'rif') as sep_rif,
           sum(n) filter (where kpi_group = 'termination') as sep_termination,
           sum(n) filter (where kpi_group = 'other') as sep_other,
           sum(n) filter (where kpi_group = 'transfer') as sep_transfer,
           sum(los_years) as experience_lost_years,
           sum(late_n) as sep_late
    from (select *, 'ALL' as scope from sep where government_wide
          union all by name select *, coalesce(department_code, 'UNKNOWN') as scope from sep)
    group by all
),
acc_w as (
    select month, scope,
           sum(n) as accessions,
           sum(n) filter (where kpi_group like 'new_hire%') as acc_new_hire,
           sum(n) filter (where kpi_group = 'new_hire_competitive') as acc_competitive,
           sum(n) filter (where kpi_group = 'new_hire_excepted') as acc_excepted,
           sum(n) filter (where kpi_group = 'new_hire_ses') as acc_ses,
           sum(n) filter (where kpi_group = 'transfer') as acc_transfer,
           sum(late_n) as acc_late
    from (select *, 'ALL' as scope from acc where government_wide
          union all by name select *, coalesce(department_code, 'UNKNOWN') as scope from acc)
    group by all
)
select h.month, h.scope, h.headcount,
       lag(h.headcount) over (partition by h.scope order by h.month) as headcount_prev,
       h.pay_n,
       columns(s.* exclude (month, scope)),
       columns(a.* exclude (month, scope))
from hc_w h
left join sep_w s using (month, scope)
left join acc_w a using (month, scope)
order by h.scope, h.month
