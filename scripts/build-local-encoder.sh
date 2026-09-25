#!/bin/bash

cd "encoders/$1/"
npm run package
cp "$1.wme" ../../dist/encoders/
