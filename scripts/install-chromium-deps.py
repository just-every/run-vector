#!/usr/bin/env python3
"""Bounded Ubuntu 24.04 Chromium launch fallback; never upgrade the runner."""
import os
from pathlib import Path
import subprocess

# Chromium runtime libraries, matching Playwright's Ubuntu 24.04 dependencies.
# No SDK removal, optional font bundle, X server or browser package is needed.
packages = [
    'libasound2t64', 'libatk-bridge2.0-0t64', 'libatk1.0-0t64', 'libatspi2.0-0t64',
    'libcairo2', 'libcups2t64', 'libdbus-1-3', 'libdrm2', 'libgbm1', 'libglib2.0-0t64',
    'libnspr4', 'libnss3', 'libpango-1.0-0', 'libx11-6', 'libxcb1', 'libxcomposite1',
    'libxdamage1', 'libxext6', 'libxfixes3', 'libxkbcommon0', 'libxrandr2',
]
archives = Path(os.environ['APT_ARCHIVES'])
archives.mkdir(parents=True, exist_ok=True)
(archives / 'partial').mkdir(exist_ok=True)
options = [
    '-o', 'Acquire::Retries=1', '-o', 'Acquire::http::Timeout=15',
    '-o', 'Acquire::https::Timeout=15', '-o', 'DPkg::Lock::Timeout=60',
    '-o', f'Dir::Cache::archives={archives}',
]
environment = {**os.environ, 'DEBIAN_FRONTEND': 'noninteractive'}
for arguments in (['update'], ['install', '-y', '--no-install-recommends', *packages]):
    subprocess.run(['apt-get', *options, *arguments], env=environment, timeout=180, check=True)
