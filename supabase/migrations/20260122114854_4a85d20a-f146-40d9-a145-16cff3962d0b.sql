-- Add UNIQUE constraint to seller_whitelist for upsert support
ALTER TABLE seller_whitelist 
ADD CONSTRAINT seller_whitelist_company_phone_unique 
UNIQUE (company_id, phone_e164);