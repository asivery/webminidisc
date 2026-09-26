#!/bin/bash

mkdir -p dist/encoders
cd "encoders/$1/"
npm run package
cp "$1.wme" ../../dist/encoders/
