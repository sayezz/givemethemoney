#!/bin/bash
set -e

echo "Building C++ Investment Tracker Backend..."

cd /app
mkdir -p build
cd build

cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)

echo "Build successful!"
