/**
 * POSIX Open Flags, Stat, and File System Constants
 */

export const OpenFlags = {
  O_RDONLY: 0,
  O_WRONLY: 1,
  O_RDWR: 2,
  O_CREAT: 0o100,
  O_EXCL: 0o200,
  O_NOCTTY: 0o400,
  O_TRUNC: 0o1000,
  O_APPEND: 0o2000,
  O_NONBLOCK: 0o4000,
  O_CLOEXEC: 0o2000000,
} as const;

export const Whence = {
  SEEK_SET: 0,
  SEEK_CUR: 1,
  SEEK_END: 2,
} as const;

export const FileMode = {
  S_IFMT: 0o170000,
  S_IFSOCK: 0o140000,
  S_IFLNK: 0o120000,
  S_IFREG: 0o100000,
  S_IFBLK: 0o060000,
  S_IFDIR: 0o040000,
  S_IFCHR: 0o020000,
  S_IFIFO: 0o010000,

  S_IRWXU: 0o0700,
  S_IRUSR: 0o0400,
  S_IWUSR: 0o0200,
  S_IXUSR: 0o0100,
  S_IRWXG: 0o0070,
  S_IRGRP: 0o0040,
  S_IWGRP: 0o0020,
  S_IXGRP: 0o0010,
  S_IRWXO: 0o0007,
  S_IROTH: 0o0004,
  S_IWOTH: 0o0020,
  S_IXOTH: 0o0001,
} as const;

export const AT_FDCWD = -100;
export const AT_SYMLINK_NOFOLLOW = 0x100;

export interface FileStat {
  st_dev: number;
  st_ino: number;
  st_mode: number;
  st_nlink: number;
  st_uid: number;
  st_gid: number;
  st_rdev: number;
  st_size: number;
  st_atime: number;
  st_mtime: number;
  st_ctime: number;
  st_blksize: number;
  st_blocks: number;
}
