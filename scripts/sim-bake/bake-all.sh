#!/bin/bash
# Final bakes, one after the other, retried if the picture comes back empty (a lost GPU context leaves it black).
for k in "$@"; do
  for try in 1 2 3; do
    node run.mjs $k 2048 400 8k "$k" 2>&1 | grep -vE "deprecated|samples "
    mean=$(node -e "require('sharp')('out/$k-plate.png').stats().then(s=>console.log(Math.round(s.channels[1].mean)))")
    echo "$k try $try mean $mean"
    [ "$mean" -gt 5 ] && break
  done
done
echo all-baked
