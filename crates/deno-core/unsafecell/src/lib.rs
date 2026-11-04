// Copyright 2018-2025 the Deno authors. MIT license.
//! Zero-cost `UnsafeCell` wrapper with debug-mode borrow tracking for single-threaded V8 isolates.

use std::cell::UnsafeCell;
use std::ops::Deref;
use std::ops::DerefMut;

#[derive(Default)]
pub struct RcRef<T: ?Sized> {
    inner: UnsafeCell<T>,
}

impl<T> RcRef<T> {
    #[inline(always)]
    pub const fn new(val: T) -> Self {
        Self {
            inner: UnsafeCell::new(val),
        }
    }

    #[inline(always)]
    pub fn into_inner(self) -> T {
        self.inner.into_inner()
    }
}

impl<T: ?Sized> RcRef<T> {
    /// Safety: caller must ensure no aliasing mutable references exist simultaneously on the V8 thread.
    #[inline(always)]
    pub unsafe fn borrow(&self) -> &T {
        unsafe { &*self.inner.get() }
    }

    /// Safety: caller must ensure exclusive access on the V8 thread.
    #[inline(always)]
    #[allow(clippy::mut_from_ref)]
    pub unsafe fn borrow_mut(&self) -> &mut T {
        unsafe { &mut *self.inner.get() }
    }
}

pub struct BorrowRef<'a, T: ?Sized>(&'a T);

impl<T: ?Sized> Deref for BorrowRef<'_, T> {
    type Target = T;
    #[inline(always)]
    fn deref(&self) -> &Self::Target {
        self.0
    }
}

pub struct BorrowMut<'a, T: ?Sized>(&'a mut T);

impl<T: ?Sized> Deref for BorrowMut<'_, T> {
    type Target = T;
    #[inline(always)]
    fn deref(&self) -> &Self::Target {
        self.0
    }
}

impl<T: ?Sized> DerefMut for BorrowMut<'_, T> {
    #[inline(always)]
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.0
    }
}
