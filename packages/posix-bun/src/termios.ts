/**
 * POSIX Termios Constants & Helpers
 */

export const TermiosConstants = {
  NCCS: 32,

  // c_iflag
  IGNBRK: 0o000001,
  BRKINT: 0o000002,
  IGNPAR: 0o000004,
  PARMRK: 0o000010,
  INPCK: 0o000020,
  ISTRIP: 0o000040,
  INLCR: 0o000100,
  IGNCR: 0o000200,
  ICRNL: 0o000400,
  IXON: 0o002000,
  IXOFF: 0o010000,

  // c_oflag
  OPOST: 0o000001,
  ONLCR: 0o000004,
  OCRNL: 0o000010,
  ONOCR: 0o000020,
  ONLRET: 0o000040,

  // c_cflag
  CSIZE: 0o000060,
  CS5: 0o000000,
  CS6: 0o000020,
  CS7: 0o000040,
  CS8: 0o000060,
  CSTOPB: 0o000100,
  CREAD: 0o000200,
  PARENB: 0o000400,
  PARODD: 0o001000,
  HUPCL: 0o002000,
  CLOCAL: 0o004000,

  // c_lflag
  ISIG: 0o000001,
  ICANON: 0o000002,
  ECHO: 0o000010,
  ECHOE: 0o000020,
  ECHOK: 0o000040,
  ECHONL: 0o000100,
  NOFLSH: 0o000200,
  TOSTOP: 0o000400,
  IEXTEN: 0o100000,

  // c_cc indices
  VINTR: 0,
  VQUIT: 1,
  VERASE: 2,
  VKILL: 3,
  VEOF: 4,
  VTIME: 5,
  VMIN: 6,
  VSUSP: 10,
  VSTART: 8,
  VSTOP: 9,

  // tcsetattr actions
  TCSANOW: 0,
  TCSADRAIN: 1,
  TCSAFLUSH: 2,
} as const;

export interface Termios {
  c_iflag: number;
  c_oflag: number;
  c_cflag: number;
  c_lflag: number;
  c_cc: Uint8Array;
  c_ispeed: number;
  c_ospeed: number;
}

export function createDefaultTermios(): Termios {
  const cc = new Uint8Array(TermiosConstants.NCCS);
  cc[TermiosConstants.VINTR] = 3; // Ctrl-C
  cc[TermiosConstants.VQUIT] = 28; // Ctrl-\
  cc[TermiosConstants.VERASE] = 127; // DEL
  cc[TermiosConstants.VKILL] = 21; // Ctrl-U
  cc[TermiosConstants.VEOF] = 4; // Ctrl-D
  cc[TermiosConstants.VMIN] = 1;
  cc[TermiosConstants.VTIME] = 0;
  cc[TermiosConstants.VSUSP] = 26; // Ctrl-Z
  cc[TermiosConstants.VSTART] = 17; // Ctrl-Q
  cc[TermiosConstants.VSTOP] = 19; // Ctrl-S

  return {
    c_iflag: TermiosConstants.ICRNL | TermiosConstants.IXON,
    c_oflag: TermiosConstants.OPOST | TermiosConstants.ONLCR,
    c_cflag:
      TermiosConstants.CS8 | TermiosConstants.CREAD | TermiosConstants.CLOCAL,
    c_lflag:
      TermiosConstants.ISIG |
      TermiosConstants.ICANON |
      TermiosConstants.ECHO |
      TermiosConstants.ECHOE |
      TermiosConstants.ECHOK |
      TermiosConstants.IEXTEN,
    c_cc: cc,
    c_ispeed: 38400,
    c_ospeed: 38400,
  };
}

export function cfmakeraw(termios: Termios): void {
  termios.c_iflag &= ~(
    TermiosConstants.IGNBRK |
    TermiosConstants.BRKINT |
    TermiosConstants.PARMRK |
    TermiosConstants.ISTRIP |
    TermiosConstants.INLCR |
    TermiosConstants.IGNCR |
    TermiosConstants.ICRNL |
    TermiosConstants.IXON
  );
  termios.c_oflag &= ~TermiosConstants.OPOST;
  termios.c_lflag &= ~(
    TermiosConstants.ECHO |
    TermiosConstants.ECHONL |
    TermiosConstants.ICANON |
    TermiosConstants.ISIG |
    TermiosConstants.IEXTEN
  );
  termios.c_cflag &= ~(TermiosConstants.CSIZE | TermiosConstants.PARENB);
  termios.c_cflag |= TermiosConstants.CS8;
  termios.c_cc[TermiosConstants.VMIN] = 1;
  termios.c_cc[TermiosConstants.VTIME] = 0;
}
