const SYMBOLS = '123456789ABCDEFG';
const shuffle = values => [...values].sort(() => Math.random() - 0.5);

function boxShape(size) {
  if (size === 4) return [2, 2];
  if (size === 6) return [2, 3];
  return [1, size];
}

function candidates(grid, row, col, size) {
  const used = new Set(grid[row].filter(Boolean));
  for (let r = 0; r < size; r++) if (grid[r][col]) used.add(grid[r][col]);
  const [boxRows, boxCols] = boxShape(size);
  const r0 = Math.floor(row / boxRows) * boxRows;
  const c0 = Math.floor(col / boxCols) * boxCols;
  for (let r = r0; r < r0 + boxRows; r++) {
    for (let c = c0; c < c0 + boxCols; c++) if (grid[r][c]) used.add(grid[r][c]);
  }
  return Array.from({ length: size }, (_, i) => SYMBOLS[i]).filter(value => !used.has(value));
}

function fillGrid(grid, size) {
  let best = null;
  let options = null;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (grid[r][c]) continue;
    const next = candidates(grid, r, c, size);
    if (!options || next.length < options.length) { best = [r, c]; options = next; }
    if (next.length === 0) return false;
  }
  if (!best) return true;
  const [row, col] = best;
  for (const value of shuffle(options)) {
    grid[row][col] = value;
    if (fillGrid(grid, size)) return true;
    grid[row][col] = '';
  }
  return false;
}

export function createMiniSudoku(difficulty = 'easy') {
  const config = {
    easy: { size: 3, blanks: 3 },
    medium: { size: 4, blanks: 7 },
    hard: { size: 6, blanks: 16 }
  }[String(difficulty).toLowerCase()];
  if (!config) throw new Error('Choose easy, medium or hard.');
  const solution = Array.from({ length: config.size }, () => Array(config.size).fill(''));
  if (!fillGrid(solution, config.size)) throw new Error('Could not generate a puzzle.');
  const puzzle = solution.map(row => [...row]);
  let removed = 0;
  for (const [r, c] of shuffle(Array.from({ length: config.size * config.size }, (_, i) => [Math.floor(i / config.size), i % config.size]))) {
    if (removed >= config.blanks) break;
    const previous = puzzle[r][c];
    puzzle[r][c] = '';
    // Keep generated puzzles uniquely solvable.
    let count = 0;
    const probe = puzzle.map(row => [...row]);
    const countSolutions = () => {
      let target = null, choices = null;
      for (let y = 0; y < config.size; y++) for (let x = 0; x < config.size; x++) {
        if (probe[y][x]) continue;
        const opts = candidates(probe, y, x, config.size);
        if (!choices || opts.length < choices.length) { target = [y, x]; choices = opts; }
      }
      if (!target) { count++; return; }
      if (!choices.length) return;
      const [y, x] = target;
      for (const value of choices) {
        probe[y][x] = value;
        countSolutions();
        probe[y][x] = '';
        if (count > 1) return;
      }
    };
    countSolutions();
    if (count === 1) removed++;
    else puzzle[r][c] = previous;
  }
  return { size: config.size, difficulty, puzzle, givens: puzzle.map(row => row.map(Boolean)), solution, createdAt: Date.now(), moves: 0 };
}

export function setMiniSudokuCell(game, row, col, value) {
  const size = game?.size;
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || row > size || col < 1 || col > size) {
    return { ok: false, error: `Row and column must be between 1 and ${size}.` };
  }
  const symbol = String(value || '').toUpperCase();
  if (!SYMBOLS.slice(0, size).includes(symbol)) {
    return { ok: false, error: `Enter a value from 1 to ${size}.` };
  }
  if (game.givens?.[row - 1]?.[col - 1] || game.puzzle[row - 1][col - 1]) return { ok: false, error: 'That cell is fixed or already filled. Clear your entry before changing it.' };
  if (!candidates(game.puzzle, row - 1, col - 1, size).includes(symbol)) return { ok: false, error: 'That number conflicts with another entry in its row, column or region.' };
  game.puzzle[row - 1][col - 1] = symbol;
  game.moves = (game.moves || 0) + 1;
  return { ok: true };
}

export function renderMiniSudoku(game, showSolution = false) {
  const grid = showSolution ? game.solution : game.puzzle;
  const header = '   ' + Array.from({ length: game.size }, (_, i) => i + 1).join('  ');
  const lines = grid.map((row, index) => `${index + 1}  ${row.map(value => value || '·').join('  ')}`);
  return [header, ...lines].join('\n');
}

export function checkMiniSudoku(game) {
  const wrong = [];
  let empty = 0;
  for (let r = 0; r < game.size; r++) for (let c = 0; c < game.size; c++) {
    const value = game.puzzle[r][c];
    if (!value) { empty++; continue; }
    if (value !== game.solution[r][c]) wrong.push([r + 1, c + 1]);
  }
  return { solved: empty === 0 && wrong.length === 0, empty, wrong };
}

export function clearMiniSudokuCell(game, row, col) {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || row > game.size || col < 1 || col > game.size) return false;
  if (game.givens?.[row - 1]?.[col - 1] || !game.puzzle[row - 1][col - 1]) return false;
  // A filled cell that was originally blank is editable; the solution is only used for validation.
  game.puzzle[row - 1][col - 1] = '';
  return true;
}
