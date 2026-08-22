// Stubs de páginas protegidas — placeholders mínimos.
// As telas reais chegam nas próximas fases; ficam num arquivo só de
// componentes pra não quebrar o fast-refresh do router.tsx.

// TODO Fase 3: substituir stub pela tela real (Home do aluno).
export function HomeStub() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cpj-bg text-cpj-white">
      <h1 className="text-2xl font-bold">Início do aluno</h1>
    </main>
  )
}

// TODO Fase 5/6: substituir stub pelo painel real do gestor.
export function GestorStub() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cpj-bg text-cpj-white">
      <h1 className="text-2xl font-bold">Painel do gestor</h1>
    </main>
  )
}

// TODO Fase 5/6: substituir stub pelo CMS real do autor.
export function AutorStub() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cpj-bg text-cpj-white">
      <h1 className="text-2xl font-bold">CMS do autor</h1>
    </main>
  )
}
