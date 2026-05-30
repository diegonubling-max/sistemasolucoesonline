-- Update user role to admin
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'diegonubling@gmail.com');

-- If the user didn't have a role yet, insert it
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' 
FROM auth.users 
WHERE email = 'diegonubling@gmail.com'
AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'diegonubling@gmail.com'));

-- Reset password and ensure confirmation
UPDATE auth.users 
SET 
  encrypted_password = crypt('admin123', gen_salt('bf')),
  email_confirmed_at = now(),
  updated_at = now(),
  last_sign_in_at = NULL -- Reset last sign in to be safe
WHERE email = 'diegonubling@gmail.com';
