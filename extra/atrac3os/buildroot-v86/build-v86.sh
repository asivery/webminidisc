#!/bin/sh
set -e

make BR2_EXTERNAL=/buildroot-v86 v86_defconfig && make
