-- ==============================================================================
-- Migration: Cascade Floor & Classroom Deletion and Remove Hardcoded Constraints
-- ==============================================================================

-- 1. Ensure classrooms table foreign key cascades on delete and update
ALTER TABLE public.classrooms 
DROP CONSTRAINT IF EXISTS classrooms_floor_id_fkey;

ALTER TABLE public.classrooms 
ADD CONSTRAINT classrooms_floor_id_fkey 
FOREIGN KEY (floor_id) REFERENCES public.floors(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- 2. Ensure timetable_events table foreign key cascades on delete and update
ALTER TABLE public.timetable_events 
DROP CONSTRAINT IF EXISTS timetable_events_classroom_id_fkey;

ALTER TABLE public.timetable_events 
ADD CONSTRAINT timetable_events_classroom_id_fkey 
FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- 3. Ensure reservations table foreign key cascades on delete and update
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS reservations_classroom_id_fkey;

ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_classroom_id_fkey 
FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;
