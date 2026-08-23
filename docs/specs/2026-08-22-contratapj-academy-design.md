# ContrataPJ Academy — Design (Spec)

**Data:** 2026-08-22
**Autor:** Diego Domingos (Head de Comercial ContrataPJ) + Claude
**Status:** Aprovado (aguardando plano de implementação)
**Working dir:** `/home/diego/segundo-cerebro/Empresas`

---

## 1. Visão geral

Plataforma (PWA web, instalável, com caminho para app nativo depois) de **treinamento interno** da ContrataPJ. Reúne os **184 playbooks comerciais** já destilados, organizados em **12 módulos**, num formato de **streaming (estilo Netflix, tema escuro)** com a identidade visual da ContrataPJ.

O aluno percorre uma **trilha sequencial**, assiste vídeos, lê/baixa o texto de cada playbook, faz um **teste ao fim de cada módulo** e ganha **certificados** ao atingir ≥80% de acerto. Uma **cadeia de metas** (prazos por módulo + metas individuais) marca o ritmo, e gestores acompanham o time.

### Objetivos
- Centralizar o método comercial ContrataPJ num só lugar, fácil de consumir.
- Padronizar a capacitação do time de vendas com trilha + avaliação + certificação.
- Dar ao gestor visibilidade de progresso, ritmo e desempenho do time.

### Não-objetivos (fora de escopo nesta versão)
- Produto público / venda do curso (é uso interno).
- Pagamentos, cadastro aberto, marketing de aquisição.
- App nativo nas lojas (fase 2, opcional; nasce como PWA).
- Correção de questões dissertativas (testes são 100% objetivos).
- **Notificações de prazo por e-mail (v2)** — não entram na v1.

---

## 2. Identidade visual

- **Estilo:** streaming / Netflix, **tema escuro** (fundo preto `#0a0a0c`).
- **Cores ContrataPJ:** azul-marinho `#1C265E`, azul royal `#4259DF` (acento principal), coral `#DE5968` (acento secundário / testes e alertas), branco `#f4f6ff` (texto).
- **Assets existentes:** `Contrata PJ/Identidade Visual/Logo_ContrataPJ/` (logo normal/branco, ícone, `Paleta.png`).
- **Padrões de UI:** hero "continue assistindo", fileiras horizontais de cards ("capas"), estados visuais concluído / atual / bloqueado.
- **Toolchain de design:** skill **`/ui-ux-pro-max`** para o frontend.
- **Toolchain de copy:** skill **`/humanizer`** para textos de interface, descrições e mensagens.

---

## 3. Perfis e permissões

| Perfil | Pode |
|--------|------|
| **Aluno** | Assistir aulas, ler/baixar textos, fazer testes, ver metas, ganhar/baixar certificados. Só enxerga o próprio progresso. |
| **Gestor** | Tudo do aluno + criar turmas, definir metas/prazos, acompanhar progresso/ranking/média do time, emitir relatórios. |
| **Autor de conteúdo** | CMS interno: criar/editar módulos, aulas (texto + vídeo) e banco de questões. Publicar/despublicar. |

Permissões aplicadas via **RLS do Supabase** por `role`.

---

## 4. Estrutura de conteúdo

```
Módulo (12)
  └── Aula / playbook (184 no total)
        ├── Texto do playbook (Markdown → render no app + download PDF)
        └── Vídeo (YouTube não listado, embed)
  └── Teste do módulo (1 por módulo, cobre todas as aulas)
```

Distribuição atual dos playbooks por módulo (fonte: série completa):
01 Prospecção(17) · 02 Abordagem(12) · 03 Diagnóstico(14) · 04 Proposta(14) · 05 Objeções(15) · 06 Fechamento(15) · 07 Follow-up(14) · 08 Gestão(17) · 09 Frameworks(8) · 10 Scripts(28) · 11 Antipadrões(16) · 12 Números(14) = **184**.

Conteúdo-fonte dos textos: `Contrata PJ/Comercial/Playbooks/_NotebookLM-MD/<modulo>/*.md` (184 arquivos limpos).

---

## 5. Regras de negócio

### 5.1 Progressão (trilha sequencial travada)
- Módulo N+1 só abre após **concluir** o módulo N.
- "Concluir módulo" = assistir todas as aulas do módulo **e** ser aprovado no teste (≥80%).
- Aula marcada como assistida ao atingir ~90% do vídeo (ou marcação manual "concluí").

### 5.2 Testes
- **Múltipla escolha**, correção automática.
- **Aprovação:** ≥ 80% de acerto.
- **Tentativas:** limitadas + espera. **Defaults configuráveis:** 3 tentativas, espera de 24h entre elas.
- **Questões sorteadas:** cada tentativa monta N questões de um **banco** maior do módulo (evita decorar).
- Registro de cada tentativa (nota, data, respostas).

### 5.3 Certificados
- **12 por módulo** (emitido ao aprovar o teste do módulo) + **1 final** ("SuperVendedor ContrataPJ", ao concluir os 12).
- PDF na identidade ContrataPJ com: nome do aluno, módulo, data de conclusão, nota, código de verificação.

### 5.4 Cadeia de metas
- **Trilha com prazo por módulo** (datas) + **metas individuais** (ritmo, ex. "1 módulo/semana", e % de acerto alvo).
- **Gestor configura** metas por turma/pessoa; **aluno** vê seu painel; **gestor** vê o do time (em dia / atrasado / ranking / média nos testes).

---

## 6. Telas principais

**Aluno**
- Home: hero "continue assistindo" + fileiras (cadeia de metas, aulas do módulo atual, certificados).
- Player da aula: vídeo (embed) + texto do playbook + botão de download (PDF).
- Teste do módulo: quiz, resultado, status de tentativas/espera.
- Meus certificados: lista + download.
- Minhas metas: progresso, prazos, alertas de atraso.

**Gestor**
- Dashboard do time: progresso agregado, atrasados, ranking, média nos testes.
- Turmas & metas: criar turma, matricular alunos, definir prazos/metas.
- Relatórios: exportação (CSV/PDF).

**Autor**
- CMS: módulos → aulas (texto md + youtube_id) → banco de questões (com marcação de corretas).

---

## 7. Modelo de dados (núcleo)

Tabelas Postgres/Supabase (com RLS):

- `profiles` — id (→ auth.users), nome, role (`aluno`|`gestor`|`autor`), avatar.
- `modules` — id, ordem (1–12), título, descrição, capa.
- `lessons` — id, module_id, ordem, título, texto_md, youtube_id, duração.
- `questions` — id, module_id, enunciado.
- `question_options` — id, question_id, texto, correta (bool).
- `classes` (turmas) — id, nome, gestor_id.
- `enrollments` — id, profile_id, class_id, data_matricula.
- `lesson_progress` — id, profile_id, lesson_id, % assistido, concluída, data.
- `quiz_attempts` — id, profile_id, module_id, nota, aprovado, respostas(jsonb), data.
- `certificates` — id, profile_id, tipo (`modulo`|`final`), module_id?, nota, data, codigo_verificacao.
- `goals` — id, escopo (`turma`|`individual`), profile_id?/class_id?, module_id?, prazo, meta_ritmo, meta_acerto.

**Datas:** timestamptz em UTC no banco; exibição sempre em **BRT (UTC-3)**.

---

## 8. Stack e integrações

- **Frontend:** React + Vite + Tailwind, PWA (instalável). Design via `/ui-ux-pro-max`.
- **Backend/DB/Auth/Storage:** Supabase (Postgres, RLS, Auth por e-mail + magic link, Storage para PDFs/certificados).
- **Vídeo:** YouTube não listado (embed via `youtube_id`).
- **Copy:** `/humanizer`.
- **Certificados PDF:** geração server-side (edge function) ou client (a decidir no plano).
- **Deploy:** Lovable/Vercel (a decidir no plano).

---

## 9. Riscos e decisões em aberto (para o plano resolver)

- Geração de PDF de certificado: edge function vs client-side.
- Import inicial dos 184 MD → tabela `lessons` (script de seed).
- Mapear quais dos 184 vídeos do NotebookLM já existem / faltam gerar.
- Gamificação (pontos/badges além do ranking) — fora da v1 salvo pedido.

### Decisões confirmadas por Diego (2026-08-22)
- **Notificações de prazo por e-mail → v2** (fora da v1).
- **Defaults dos testes mantidos:** 3 tentativas, espera de 24h entre elas, questões sorteadas de um banco por módulo.

---

## 10. Toolchain de implementação (decidido)

- **`/ui-ux-pro-max`** → design/implementação do frontend.
- **`/humanizer`** → todos os textos de interface e mensagens.
- **Modelo:** implementação com **Opus**.
- **Regra:** nada é implementado até ordem explícita do Diego.
