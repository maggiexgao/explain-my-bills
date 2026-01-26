-- Fix the count_distinct_codes function with proper permissions
-- Drop existing and recreate with better error handling
DROP FUNCTION IF EXISTS count_distinct_codes(text, text);

CREATE OR REPLACE FUNCTION public.count_distinct_codes(p_table_name text, p_code_column text DEFAULT 'hcpcs')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result integer;
BEGIN
  -- Validate table name to prevent SQL injection
  IF p_table_name NOT IN ('mpfs_benchmarks', 'opps_addendum_b', 'clfs_fee_schedule', 
                          'dmepos_fee_schedule', 'dmepen_fee_schedule', 'gpci_localities', 
                          'zip_to_locality') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;
  
  -- Validate column name
  IF p_code_column NOT IN ('hcpcs', 'locality_num', 'zip5') THEN
    RAISE EXCEPTION 'Invalid column name: %', p_code_column;
  END IF;
  
  EXECUTE format('SELECT COUNT(DISTINCT %I) FROM %I WHERE %I IS NOT NULL AND %I != ''''', 
                 p_code_column, p_table_name, p_code_column, p_code_column)
  INTO result;
  
  RETURN COALESCE(result, 0);
END;
$$;

-- Grant permissions to all roles
GRANT EXECUTE ON FUNCTION public.count_distinct_codes(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.count_distinct_codes(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_distinct_codes(text, text) TO service_role;