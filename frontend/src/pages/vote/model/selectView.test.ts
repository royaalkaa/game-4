import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { makeBattle, makeMatch, makePhoto } from '@test/fixtures';
import { selectVoteView } from './selectView';

describe('selectVoteView', () => {
  const match = makeMatch();

  it('waits for the battle', () => {
    expect(selectVoteView({ lastVote: null })).toEqual({ kind: 'loading' });
  });

  it('shows not found and other errors from the battle request', () => {
    expect(selectVoteView({ battleError: new ApiError(404, 'not_found', 'Нет'), lastVote: null }).kind).toBe(
      'not_found',
    );
    expect(selectVoteView({ battleError: new ApiError(0, 'network_error', 'Нет связи'), lastVote: null })).toEqual({
      kind: 'error',
      message: 'Нет связи',
    });
  });

  it('asks to scan the QR when the viewer has not joined', () => {
    expect(selectVoteView({ battle: makeBattle({ joined: false }), nextMatch: match, lastVote: null }).kind).toBe(
      'not_joined',
    );
    expect(
      selectVoteView({
        battle: makeBattle(),
        nextMatchError: new ApiError(401, 'not_joined', 'Войди'),
        lastVote: null,
      }).kind,
    ).toBe('not_joined');
  });

  it('shows the next duel', () => {
    expect(selectVoteView({ battle: makeBattle(), nextMatch: match, lastVote: null })).toEqual({
      kind: 'duel',
      match,
    });
  });

  it('shows the result of the last vote before the next duel', () => {
    const voted = makeMatch({ my_vote: 1, votes_a: 3, votes_b: 1 });
    expect(selectVoteView({ battle: makeBattle(), nextMatch: match, lastVote: voted })).toEqual({
      kind: 'result',
      match: voted,
    });
  });

  it('says everything is voted when no duel is left', () => {
    expect(selectVoteView({ battle: makeBattle(), nextMatch: null, lastVote: null }).kind).toBe('all_voted');
  });

  it('waits for the next duel while it loads', () => {
    expect(selectVoteView({ battle: makeBattle(), lastVote: null }).kind).toBe('loading');
  });

  it('shows the break between rounds', () => {
    expect(selectVoteView({ battle: makeBattle({ round_state: 'break' }), lastVote: null }).kind).toBe('break');
  });

  it('shows the winner to everyone after the final, joined or not', () => {
    const battle = makeBattle({ status: 'finished', round_state: null, joined: false, winner: makePhoto(1) });
    expect(selectVoteView({ battle, lastVote: null }).kind).toBe('finished');
  });

  it('reports a stopped battle', () => {
    expect(selectVoteView({ battle: makeBattle({ status: 'stopped' }), lastVote: null }).kind).toBe('stopped');
  });

  it('reports a failed next-match request', () => {
    expect(
      selectVoteView({
        battle: makeBattle(),
        nextMatchError: new ApiError(500, 'http_error', 'Сбой'),
        lastVote: null,
      }),
    ).toEqual({ kind: 'error', message: 'Сбой' });
  });
});
