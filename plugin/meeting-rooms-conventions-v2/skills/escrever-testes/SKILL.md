---
name: escrever-testes
description: Use ao escrever ou acrescentar teste neste projeto — onde o arquivo vive, como a aplicação sobe no teste, o que afirmar sobre a resposta HTTP.
---

# Escrever teste no padrão do projeto

Procedimento para escrever teste no padrão já usado nesta base, com
Vitest.

## Onde o arquivo vive

Cada recurso tem seu arquivo em `tests/<recurso>.test.ts` (por exemplo
`tests/bookings.test.ts`, `tests/rooms.test.ts`). Um teste novo para um
recurso que já tem arquivo entra nesse arquivo existente, junto dos
testes que já cobrem esse recurso — não crie um segundo arquivo para o
mesmo recurso.

## Como a aplicação sobe no teste

Use o auxiliar `createTestApp()` de `tests/helpers/app.ts`, que constrói
a aplicação Fastify completa e a deixa pronta (`app.ready()`). Chame
`resetDb()` do mesmo auxiliar em `beforeEach` para partir de um banco
limpo a cada teste — não dependa da ordem de execução entre testes para
o estado do banco.

Requisição à API é feita com `app.inject({ method, url, payload })`, não
com um cliente HTTP real subindo o servidor numa porta.

## O que afirmar sobre a resposta

Confira o `statusCode` da resposta contra o código esperado (`201` para
criação, `400` para entrada inválida, `404` para recurso inexistente,
`409` para conflito) e o conteúdo relevante de `response.json()` — não
baseie a asserção em detalhe de implementação (nome de variável interna,
ordem de chamada), e sim no que a API efetivamente devolve para quem a
consome.

## Teste novo em arquivo existente

Um teste que descreve comportamento que já existia continua valendo:
acrescentar caso a um arquivo de teste existente é o padrão esperado.
Remover ou enfraquecer um teste existente para fazer algo passar não é
— se um teste existente parece estar errado, o caminho é investigar por
que, não apagá-lo.
