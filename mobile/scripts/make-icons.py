#!/usr/bin/env python3
"""Draw the Cluse icon from tools/make-icon.py. Do not change that geometry."""

import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).resolve().parents[2] / "tools" / "make-icon.py"), run_name="__main__")
