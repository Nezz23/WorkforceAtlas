-- Separations and federal experience lost by fiscal year and occupational group, government-wide (transfers excluded).
with hc as (
    select month // 100 + (month % 100 >= 10)::int as fy, occ_group, sum(n) as n, count(distinct month) as m
    from read_parquet('data/warehouse/headcount/*.parquet') group by all
),
sep as (
    select s.month // 100 + (s.month % 100 >= 10)::int as fy, s.occ_group,
           sum(s.n) as separations, sum(s.los_years) as experience_lost_years, sum(s.n) filter (where s.drp) as drp
    from read_parquet('data/warehouse/separations/*.parquet') s
    join read_csv('ref/separation_categories.csv') r on r.code = s.category
    where r.government_wide group by all
)
select fy, occ_group, hc.n / hc.m as avg_headcount, coalesce(separations, 0) as separations,
       coalesce(experience_lost_years, 0) as experience_lost_years, coalesce(drp, 0) as drp
from hc left join sep using (fy, occ_group)
