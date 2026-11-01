import { spawnSync } from 'node:child_process';

/**
 * Запускает команду в реальном PTY заданной высоты; stdout содержит полный поток терминала.
 */
export function runInTerminal(args, rows = 24, columns = 100) {
  const python = `
import fcntl, os, pty, struct, sys, termios
pid, fd = pty.fork()
if pid == 0:
    fcntl.ioctl(1, termios.TIOCSWINSZ, struct.pack('HHHH', int(sys.argv[1]), int(sys.argv[2]), 0, 0))
    os.execv(sys.argv[3], sys.argv[3:])
while True:
    try:
        data = os.read(fd, 65536)
        if not data:
            break
        sys.stdout.buffer.write(data)
    except OSError:
        break
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
`;
  return spawnSync(
    'python3',
    ['-c', python, String(rows), String(columns), ...args],
    {
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        TERM: 'xterm',
        NO_COLOR: '1',
        FORCE_COLOR: undefined,
      },
    },
  );
}

/**
 * Воспроизводит используемые CLI команды VT: перемещение, очистку строки, переносы и прокрутку.
 * Возвращает историю вместе с видимым экраном, чтобы проверять финальные строки после перерисовки.
 */
export function terminalLines(output, rows = 24, columns = 100) {
  const history = [];
  const screen = Array.from({ length: rows }, () => Array(columns).fill(' '));
  let row = 0;
  let column = 0;
  /**
   * Переносит курсор вниз; верхняя строка при прокрутке сохраняется в истории.
   */
  function newline() {
    row++;
    if (row === rows) {
      history.push(screen.shift().join('').trimEnd());
      screen.push(Array(columns).fill(' '));
      row--;
    }
  }
  for (let index = 0; index < output.length;) {
    const sequence = /^\u001b\[([\d;?]*)([A-Za-z])/.exec(output.slice(index));
    if (sequence) {
      const amount = Number(sequence[1]) || 1;
      if (sequence[2] === 'A') {
        row = Math.max(0, row - amount);
      }
      if (sequence[2] === 'B') {
        row = Math.min(rows - 1, row + amount);
      }
      if (sequence[2] === 'G') {
        column = Math.min(columns - 1, amount - 1);
      }
      if (sequence[2] === 'K') {
        const start = sequence[1] === '2' ? 0 : Math.min(column, columns - 1);
        screen[row].fill(' ', start);
      }
      index += sequence[0].length;
      continue;
    }
    const character = output[index++];
    if (character === '\r') {
      column = 0;
    } else if (character === '\n') {
      newline();
    } else if (character >= ' ') {
      if (column >= columns) {
        column = 0;
        newline();
      }
      screen[row][column++] = character;
    }
  }
  return [...history, ...screen.map((line) => line.join('').trimEnd())];
}
