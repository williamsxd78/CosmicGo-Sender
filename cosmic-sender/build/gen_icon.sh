#!/bin/bash
set -e
# Create a 512x512 gradient icon with a spark
convert -size 512x512 gradient:'#8b6bff-#22d3ee' \
        -draw "fill white stroke none path 'M 256 90 L 296 216 L 422 216 L 320 292 L 360 418 L 256 342 L 152 418 L 192 292 L 90 216 L 216 216 Z'" \
        -flatten icon.png
# Multi-size ICO
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
ls -la icon.png icon.ico
