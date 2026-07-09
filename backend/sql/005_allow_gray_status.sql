-- Allow gray status for no_clear_imagery rows
ALTER TABLE field_analyses DROP CONSTRAINT IF EXISTS field_analyses_status_color_check;
ALTER TABLE field_analyses ADD CONSTRAINT field_analyses_status_color_check
  CHECK (status_color IN ('green', 'yellow', 'red', 'gray'));
