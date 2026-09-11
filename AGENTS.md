# contratapj-academy — agent context

Academy / learning app. React + Vite + TypeScript, Vitest.

## The trap this repo has already hit

**Case-only filename differences break only on case-insensitive filesystems, so CI never sees
them** (#1). `lessonSlides.ts` (util) and `LessonSlides.tsx` (component) lived in one folder;
`import './LessonSlides'` resolved to the **util** on macOS and `npm run build` exited 2, while
Linux CI stayed green.

The repo's own convention — camelCase for utils, PascalCase for components — *produces* the
collision whenever the two roots match. Before adding a file, check whether its name differs
from an existing one only by case. If it does, rename one of them.

## Conventions

- Code comments and commit messages in **English**; conventional commits (`fix(scope): …`).
- PR titles and bodies in **pt-BR**.
- Never push to `main`; feature branch + PR.

## House review rules

PRs here are reviewed automatically against the org-wide rule set. This file carries only what
is specific to **this repo** — shared rules live in one place rather than being copied into
every repository, because a copy cannot fail when the original moves.
