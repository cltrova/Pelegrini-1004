
-- Cria user fictício em auth.users (necessário pela FK de profiles)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES (
  'aaaaaaaa-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'joao.silva.fake@teste.com',
  crypt('FakeUser2026!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"João Silva (FAKE)"}'::jsonb,
  false, '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;
