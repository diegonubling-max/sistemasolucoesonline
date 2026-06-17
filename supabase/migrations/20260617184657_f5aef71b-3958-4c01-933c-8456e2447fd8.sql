DROP TRIGGER IF EXISTS trg_notify_push_matricula ON public.matriculas;
DROP TRIGGER IF EXISTS trg_notify_push_pagamento ON public.parcelas;
DROP FUNCTION IF EXISTS public.notify_push_matricula();
DROP FUNCTION IF EXISTS public.notify_push_pagamento();