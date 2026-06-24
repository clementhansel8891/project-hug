SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='retail_orders' 
ORDER BY ordinal_position;
