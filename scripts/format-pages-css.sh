#!/usr/bin/env bash
set -euo pipefail

# Organize the single page stylesheet in place.
# This intentionally keeps pages.css as one file and does not split or remove it.

npx --yes prettier@3.6.2 --write assets/css/pages.css
