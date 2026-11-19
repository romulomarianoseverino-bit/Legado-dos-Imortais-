import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getNextRoomPlayerId } from '../src/utils/playerIds';

test('usa o maior ID existente quando há lacunas na sala', () => {
  assert.equal(getNextRoomPlayerId([{ id: 1 }, { id: 3 }]), 4);
});

test('começa em 1 para uma sala vazia', () => {
  assert.equal(getNextRoomPlayerId([]), 1);
});

test('não reutiliza ID quando o último jogador saiu', () => {
  assert.equal(getNextRoomPlayerId([{ id: 1 }, { id: 2 }, { id: 4 }]), 5);
});
