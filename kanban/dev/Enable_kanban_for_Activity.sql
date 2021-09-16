do $$
DECLARE
featureCode varchar(100) = 'EnableKanbanForActivitySection';
featureId UUID;
BEGIN
featureId = (select "Id" from "Feature" where "Code" = featureCode limit 1);
IF featureId is null THEN
insert into "Feature"
("Name", "Code")
values
(featureCode, featureCode);
featureId = (select "Id" from "Feature" where "Code" = featureCode limit 1);
end IF;
delete from "AdminUnitFeatureState" where "FeatureId" = featureId;
insert into "AdminUnitFeatureState"
("SysAdminUnitId", "FeatureState", "FeatureId")
values
('A29A3BA5-4B0D-DE11-9A51-005056C00008', 1, featureId),
('720B771C-E7A7-4F31-9CFB-52CD21C3739F', 1, featureId);
end $$;