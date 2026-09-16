**T1 — Regras de validação de reservas**

A API de reservas aceita hoje pedidos que não deveria aceitar. Ajuste o comportamento para que o contrato abaixo seja verdadeiro. As regras valem tanto para a criação quanto para a atualização de uma reserva.

1. Duas reservas ativas na mesma sala não podem ocupar o mesmo intervalo de tempo, em nenhuma forma de sobreposição. A comparação é estrita nas bordas: uma reserva que termina às 10:00 e outra que começa às 10:00 convivem. Pedido que viole a regra responde 409. Ao atualizar, a comparação considera as demais reservas ativas da sala.
2. Reserva cancelada não ocupa horário. Cancelar uma reserva libera o intervalo.
3. Reserva cujo início já passou é rejeitada com 400.
4. A duração mínima é de 30 minutos e a máxima de 8 horas, ambas permitidas. Fora desse intervalo, 400.
5. O fim precisa ser posterior ao início. Caso contrário, 400.
6. Pedido que referencia sala ou usuário inexistente responde 404.
7. Os erros seguem o formato já usado pela API.
8. Nenhum comportamento existente e não citado acima deve mudar.

Não há canal para dúvidas nesta execução. Decida e implemente.
