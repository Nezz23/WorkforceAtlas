-- Shared band definitions. Locked in docs/03-data-and-kpis.md; change both together.
create or replace macro num(x) as try_cast(x as double);
create or replace macro los_band(x) as case
    when x is null then 'Unknown' when x < 1 then '<1' when x < 3 then '1-2' when x < 5 then '3-4'
    when x < 10 then '5-9' when x < 20 then '10-19' when x < 30 then '20-29' else '30+' end;
create or replace macro grade_band(plan, grade) as case
    when plan = 'GS' and grade between '01' and '07' then 'GS 1-7'
    when plan = 'GS' and grade between '08' and '12' then 'GS 8-12'
    when plan = 'GS' and grade between '13' and '15' then 'GS 13-15'
    when plan in ('ES', 'EX', 'SL', 'ST') then 'Senior'
    else 'Other plans' end;
-- Supervisor or manager (2), supervisor CSRA (4), management official CSRA (5). Leaders (6, 7) are not.
create or replace macro is_supervisor(code) as code in ('2', '4', '5');
