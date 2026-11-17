-- Code-to-name lookups as published in this file.
select 'department' as dim, department_code as code, any_value(department) as name from src group by all
union all select 'agency', agency_code, any_value(agency) from src group by all
union all select 'occ_group', occupational_group_code, any_value(occupational_group) from src group by all
