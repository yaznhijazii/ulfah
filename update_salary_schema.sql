-- Add billing_period to salary_plans to track monthly plans
ALTER TABLE salary_plans ADD COLUMN IF NOT EXISTS billing_period DATE;

-- Add spent_amount to salary_plan_items to track deductions
ALTER TABLE salary_plan_items ADD COLUMN IF NOT EXISTS spent_amount DECIMAL(12, 2) DEFAULT 0;

-- Optional: Add a unique constraint to prevent multiple plans for the same month/partnership
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_plans_month ON salary_plans (partnership_id, billing_period);
