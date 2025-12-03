# Atrac3 VM

This directory contains patches for the [v86](https://copy.sh/v86) project (commit `b6c940d0d481a43d`) needed to run Atrac3 OS.

While not strictly necessary, these patches bring almost a 2x speed improvement.

## How it works

While v86 comes with an 80-bit precision FPU, `psp_at3tool.exe` uses only 32-bit precision arithmetic to perform its computations.

In `fpu.rs` and `softfloat.rs`, dropping arithmetic precision from 80-bit to 64-bit allows us to save compute power while still maintaining all the precision that `psp_at3tool.exe` needs for its 32-bit operations.

Also, since `psp_at3tool.exe` is not an interactive tool, we can increase `TIME_PER_FRAME` in `cpu.rs` to reduce VM interruptions.

## How to build

Just follow the instructions at [v86](https://copy.sh/v86). Note that they provide a Docker image to build the project.

Before launching the `make all` command, replace the v86 files with those in the `patched/` directory.

The patched files are based on commit `b6c940d0d481a43d`.