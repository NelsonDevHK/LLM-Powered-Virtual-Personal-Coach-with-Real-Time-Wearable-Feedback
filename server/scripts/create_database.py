#!/usr/bin/env python3
"""
DEPRECATED: This script was a duplicate of ../create_db.py and is no longer maintained.
Please use `server/create_db.py` instead.

Running this file will simply print a message and exit so that any
existing automation referencing the older path doesn’t break
silently.
"""

import sys


if __name__ == "__main__":
    print("❌ This script is deprecated.")
    print("📌 Use this instead:")
    print("   export DB_NAME=fyp_coach")
    print("   python3 server/create_db.py")
    sys.exit(0)
