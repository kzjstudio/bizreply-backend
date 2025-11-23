-- FIX: Corrected is_business_open function
-- The original function was checking store_hours_data -> 'monday' 
-- but the actual structure is store_hours_data -> 'days' -> 'monday'

CREATE OR REPLACE FUNCTION is_business_open(
    business_id_param UUID,
    check_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS BOOLEAN AS $$
DECLARE
    store_hours_data JSONB;
    day_of_week TEXT;
    time_to_check TIME;
    day_hours JSONB;
    business_timezone TEXT;
    localized_time TIMESTAMPTZ;
BEGIN
    -- Get store hours
    SELECT store_hours INTO store_hours_data
    FROM businesses
    WHERE id = business_id_param;
    
    IF store_hours_data IS NULL THEN
        RETURN TRUE; -- Assume open if no hours specified
    END IF;
    
    -- Get timezone from store_hours, default to UTC
    business_timezone := store_hours_data ->> 'timezone';
    IF business_timezone IS NULL THEN
        business_timezone := 'UTC';
    END IF;
    
    -- Convert check_time to business timezone
    localized_time := check_time AT TIME ZONE business_timezone;
    
    -- Get day of week (lowercase, no spaces)
    day_of_week := LOWER(TO_CHAR(localized_time, 'Day'));
    day_of_week := TRIM(day_of_week);
    
    -- FIX: Access days.{day_of_week} instead of just {day_of_week}
    day_hours := store_hours_data -> 'days' -> day_of_week;
    
    IF day_hours IS NULL THEN
        RETURN TRUE; -- No specific hours for this day, assume open
    END IF;
    
    -- Check if closed
    IF (day_hours ->> 'closed')::BOOLEAN IS TRUE THEN
        RETURN FALSE;
    END IF;
    
    -- Check time range
    time_to_check := localized_time::TIME;
    
    RETURN time_to_check >= (day_hours ->> 'open')::TIME 
        AND time_to_check < (day_hours ->> 'close')::TIME;
END;
$$ LANGUAGE plpgsql;

-- Also update get_next_opening_time with same fix
CREATE OR REPLACE FUNCTION get_next_opening_time(
    business_id_param UUID
) RETURNS TEXT AS $$
DECLARE
    store_hours_data JSONB;
    day_of_week TEXT;
    day_hours JSONB;
    days TEXT[] := ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    current_day_index INT;
    check_day_index INT;
    check_day TEXT;
    business_timezone TEXT;
    localized_now TIMESTAMPTZ;
BEGIN
    -- Get store hours
    SELECT store_hours INTO store_hours_data
    FROM businesses
    WHERE id = business_id_param;
    
    IF store_hours_data IS NULL THEN
        RETURN 'Store hours not configured';
    END IF;
    
    -- Get timezone
    business_timezone := store_hours_data ->> 'timezone';
    IF business_timezone IS NULL THEN
        business_timezone := 'UTC';
    END IF;
    
    localized_now := NOW() AT TIME ZONE business_timezone;
    
    -- Get current day index
    day_of_week := LOWER(TO_CHAR(localized_now, 'Day'));
    day_of_week := TRIM(day_of_week);
    current_day_index := array_position(days, day_of_week);
    
    -- Check next 7 days
    FOR i IN 0..6 LOOP
        check_day_index := ((current_day_index + i - 1) % 7) + 1;
        check_day := days[check_day_index];
        
        -- FIX: Access days.{check_day}
        day_hours := store_hours_data -> 'days' -> check_day;
        
        IF day_hours IS NOT NULL AND (day_hours ->> 'closed')::BOOLEAN IS NOT TRUE THEN
            RETURN 'Next opening: ' || INITCAP(check_day) || ' at ' || (day_hours ->> 'open');
        END IF;
    END LOOP;
    
    RETURN 'Always closed';
END;
$$ LANGUAGE plpgsql;

-- Test the fix
SELECT is_business_open('85732846-c2b4-4c60-b651-08d5f606eef0'::UUID);
SELECT get_next_opening_time('85732846-c2b4-4c60-b651-08d5f606eef0'::UUID);
