#!/usr/bin/env bash

docker build -t buildroot .

docker run \
    --rm \
    --name atrac3os-builder \
    -v $PWD/dist:/build \
    -v $PWD/buildroot-v86/:/buildroot-v86 \
    buildroot

# Debug
# docker run \
#     --name atrac3os-builder \
#     -v $PWD/dist:/build \
#     -v $PWD/buildroot-v86/:/buildroot-v86 \
#     -ti \
#     --entrypoint "bash" \
#     buildroot-v2