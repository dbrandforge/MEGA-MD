import { describe, expect, it } from 'vitest';
import { createMiniSudoku, setMiniSudokuCell, checkMiniSudoku } from '../../lib/miniSudoku.js';
import { chessInitialState, makeChessMove, chessStatus } from '../../lib/chessEngine.js';
import { checkersInitialState, checkersLegalMoves, makeCheckersMove, checkersStatus } from '../../lib/checkersEngine.js';

describe('Mini Sudoku', () => {
  it.each([['easy', 3], ['medium', 4], ['hard', 6]])('generates a playable %s %sx%s board', (difficulty, size) => {
    const game = createMiniSudoku(difficulty);
    expect(game.size).toBe(size);
    expect(game.puzzle).toHaveLength(size);
    expect(game.givens).toHaveLength(size);
    expect(checkMiniSudoku(game).empty).toBeGreaterThan(0);
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (!game.puzzle[r][c]) {
        const result = setMiniSudokuCell(game, r + 1, c + 1, game.solution[r][c]);
        expect(result.ok).toBe(true);
      }
    }
    expect(checkMiniSudoku(game).solved).toBe(true);
  });

  it('rejects conflicting entries and preserves fixed clues', () => {
    const game = createMiniSudoku('easy');
    const fixed = game.givens.findIndex(row => row.some(Boolean));
    const row = game.givens[fixed].findIndex(Boolean);
    expect(setMiniSudokuCell(game, fixed + 1, row + 1, game.solution[fixed][row]).ok).toBe(false);
  });
});

describe('Chess engine', () => {
  it('accepts legal moves and rejects illegal moves', () => {
    const state = chessInitialState();
    expect(makeChessMove(state, 'e2', 'e4').ok).toBe(true);
    expect(makeChessMove(state, 'e2', 'e5').ok).toBe(false);
  });

  it('detects checkmate (Fool’s Mate)', () => {
    let state = chessInitialState();
    for (const [from, to] of [['f2','f3'], ['e7','e5'], ['g2','g4'], ['d8','h4']]) {
      const result = makeChessMove(state, from, to);
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(chessStatus(state)).toMatchObject({ over: true, checkmate: true, winner: 'b' });
  });
});

describe('Checkers engine', () => {
  it('starts with legal moves and supports a normal move', () => {
    const state = checkersInitialState();
    expect(checkersLegalMoves(state).length).toBeGreaterThan(0);
    expect(makeCheckersMove(state, 'a3', 'b4').ok).toBe(true);
  });

  it('enforces compulsory captures', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(''));
    board[5][0] = 'w'; board[4][1] = 'b'; board[5][4] = 'w'; board[2][7] = 'b';
    const state = { board, turn: 'w', forcedFrom: null, history: [] };
    const moves = checkersLegalMoves(state);
    expect(moves).toHaveLength(1);
    expect(moves[0].capture).toEqual([4, 1]);
    const result = makeCheckersMove(state, 'a3', 'c5');
    expect(result.ok).toBe(true);
    expect(result.state.board[4][1]).toBe('');
  });

  it('detects a winner when a side has no pieces', () => {
    const state = checkersInitialState();
    state.board = Array.from({ length: 8 }, () => Array(8).fill(''));
    state.board[5][0] = 'w';
    expect(checkersStatus(state)).toMatchObject({ over: true, winner: 'w' });
  });
});
