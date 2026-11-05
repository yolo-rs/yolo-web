/**
 * POSIX.1-2024 Signal definitions and helpers
 */

export const Signal = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGILL: 4,
  SIGTRAP: 5,
  SIGABRT: 6,
  SIGBUS: 7,
  SIGFPE: 8,
  SIGKILL: 9,
  SIGUSR1: 10,
  SIGSEGV: 11,
  SIGUSR2: 12,
  SIGPIPE: 13,
  SIGALRM: 14,
  SIGTERM: 15,
  SIGCHLD: 17,
  SIGCONT: 18,
  SIGSTOP: 19,
  SIGTSTP: 20,
  SIGTTIN: 21,
  SIGTTOU: 22,
  SIGURG: 23,
  SIGXCPU: 24,
  SIGXFSZ: 25,
  SIGVTALRM: 26,
  SIGPROF: 27,
  SIGWINCH: 28,
  SIGIO: 29,
  SIGSYS: 31,
} as const;

export type SignalCode = (typeof Signal)[keyof typeof Signal];

export const SA_NOCLDSTOP = 0x00000001;
export const SA_NOCLDWAIT = 0x00000002;
export const SA_SIGINFO = 0x00000004;
export const SA_ONSTACK = 0x08000000;
export const SA_RESTART = 0x10000000;
export const SA_NODEFER = 0x40000000;
export const SA_RESETHAND = 0x80000000;

export class SigSet {
  private mask: bigint;

  constructor(initialMask: bigint = 0n) {
    this.mask = initialMask;
  }

  static empty(): SigSet {
    return new SigSet(0n);
  }

  static fill(): SigSet {
    return new SigSet(0xffffffffffffffffn);
  }

  add(sig: SignalCode): void {
    this.mask |= 1n << BigInt(sig - 1);
  }

  del(sig: SignalCode): void {
    this.mask &= ~(1n << BigInt(sig - 1));
  }

  has(sig: SignalCode): boolean {
    return (this.mask & (1n << BigInt(sig - 1))) !== 0n;
  }

  toBigInt(): bigint {
    return this.mask;
  }
}
