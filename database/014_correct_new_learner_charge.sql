BEGIN;
UPDATE site_state
SET value = value || '{"newRegistrationFee":0,"reportBookFee":250}'::jsonb
WHERE state_key='dipvtc_school_price_rules';
COMMIT;
