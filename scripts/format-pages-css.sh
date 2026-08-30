#!/usr/bin/env bash
set -euo pipefail

# Format the single legacy page stylesheet in place.
# This intentionally does NOT split, rename, or remove pages.css.
npx --yes prettier@3.6.2 --write assets/css/pages.css
