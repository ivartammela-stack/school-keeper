-- Make columns nullable so we can preserve data when user is deleted
ALTER TABLE tickets ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE ticket_comments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE audit_log ALTER COLUMN user_id DROP NOT NULL;