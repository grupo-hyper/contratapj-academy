-- 0006_module_covers.sql
-- Define as capas (capa_url) dos 6 primeiros módulos da Academy.
-- As imagens ficam versionadas no repo em public/covers/ e são servidas
-- na raiz do site (/covers/NN-slug.png) — funcionam offline no PWA.
-- Idempotente: atualiza por `ordem` (coluna UNIQUE).

update public.modules set capa_url = '/covers/01-prospeccao.png' where ordem = 1;
update public.modules set capa_url = '/covers/02-abordagem.png'  where ordem = 2;
update public.modules set capa_url = '/covers/03-diagnostico.png' where ordem = 3;
update public.modules set capa_url = '/covers/04-proposta.png'    where ordem = 4;
update public.modules set capa_url = '/covers/05-objecoes.png'    where ordem = 5;
update public.modules set capa_url = '/covers/06-fechamento.png'  where ordem = 6;
