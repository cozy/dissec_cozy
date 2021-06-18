#!/bin/bash

target="build/services/contribution/dissecozy.js"
firstChar=$(head -c 1 $target)

chmod +x $target
if [[ $firstChar != \#* ]]; then
  sed -i '' '1i\
  #!/usr/bin/env node
  ' $target
fi
yarn run cozy-konnector-dev -m manifest.webapp $target