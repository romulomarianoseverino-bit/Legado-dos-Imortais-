/**
 * Gera um identificador de jogador livre sem depender da quantidade atual
 * de jogadores. Isso evita colisões quando alguém sai de uma sala em espera.
 */
export function getNextRoomPlayerId(players: ReadonlyArray<{ id: number }>): number {
  return players.reduce(
    (highest, player) => Number.isSafeInteger(player.id) ? Math.max(highest, player.id) : highest,
    0
  ) + 1;
}
