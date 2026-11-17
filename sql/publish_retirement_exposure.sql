-- Retirement-exposure proxy per month: share of headcount that is (age 55+ and 30+ years of service),
-- or (age 60+ and 20+ years), or (age 65+ and 5+ years). Age is published in 5-year brackets, so the
-- third rule uses 65+ in place of 62+: the proxy is a lower bound and not true eligibility.
select month, case when grouping(department_code) = 1 then 'ALL' else coalesce(department_code, 'UNKNOWN') end as scope, sum(n) as headcount,
       sum(n) filter (where (age_bracket in ('55-59', '60-64', '65 OR MORE') and los_band = '30+')
                         or (age_bracket in ('60-64', '65 OR MORE') and los_band in ('20-29', '30+'))
                         or (age_bracket = '65 OR MORE' and los_band in ('5-9', '10-19', '20-29', '30+'))) as exposed
from (select * replace (nullif(department_code, 'No Data Reported') as department_code) from read_parquet('data/warehouse/headcount/*.parquet'))
group by grouping sets ((month), (month, department_code))
