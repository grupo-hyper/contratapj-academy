/**
 * lessonSlides — divide o `texto_md` da aula (já sem o h1 e sem a seção de
 * fontes) em SLIDES, um por seção `## N. Título`.
 *
 * Estrutura real das 184 aulas (ver spec de identidade visual): toda aula tem
 * seções numeradas `## N. Seção` (184/184). Cada uma vira um slide. Tudo que
 * vem ANTES da primeira `##` (regra de ouro + introdução) é o slide de abertura.
 *
 * Regras:
 *  - só quebra em `##` de nível 2 exatamente (não `#` nem `###`);
 *  - o heading inicia o slide seguinte (fica junto do seu conteúdo);
 *  - fatias em branco são descartadas;
 *  - sem nenhuma `##` → a aula inteira é um único slide;
 *  - markdown vazio/nulo → nenhum slide (`[]`).
 */

/** `## ` no início de uma linha (após espaços), mas não `###`. */
const SECTION_HEADING = /^[ \t]*##(?!#)\s/

export function splitIntoSlides(markdown: string | null | undefined): string[] {
  if (!markdown || markdown.trim() === '') return []

  const lines = markdown.split('\n')
  const slides: string[] = []
  let current: string[] = []

  const flush = () => {
    const text = current.join('\n').trim()
    if (text !== '') slides.push(text)
    current = []
  }

  for (const line of lines) {
    if (SECTION_HEADING.test(line)) flush() // nova seção → fecha o slide atual
    current.push(line)
  }
  flush()

  return slides
}
