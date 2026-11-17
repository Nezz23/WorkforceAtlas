-- Accessions processed in the file month. late_n counts actions whose effective month is earlier.
select _month as month, department_code, agency_code, occupational_group_code as occ_group,
       grade_band(pay_plan_code, grade) as grade_band, los_band(num(length_of_service_years)) as los_band,
       coalesce(age_bracket, 'Unknown') as age_bracket, is_supervisor(supervisory_status_code) as supervisor,
       accession_category_code as category,
       count(*) as n,
       count(*) filter (where personnel_action_effective_date_yyyymm::int < _month) as late_n
from src
group by all
