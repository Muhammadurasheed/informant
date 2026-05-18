
import sys
import os
import asyncio
from typing import Dict, Any

# Add backend to path dynamically
if os.path.isdir('app'):
    sys.path.append(os.getcwd())
elif os.path.isdir('backend/app'):
    sys.path.append(os.path.join(os.getcwd(), 'backend'))
else:
    # try one level up if run from tests/
    sys.path.append(os.path.join(os.getcwd(), '../backend'))

from app.routes.websocket import convert_to_scholarship

# Mock data that caused the crash (from user logs)
CRASH_DATA = {
    'title': 'HackUTA 2024',
    'organization': 'MLH',
    'amount_value': None,
    'amount_display': None,
    'deadline': None,
    'description': None,
    'url': 'https://www.hackuta.org/',
    'type': 'Hackathon',
    'eligibility': None
}

def test_backend_validation():
    print(">> Testing Backend Validation Logic...")
    try:
        result = convert_to_scholarship(CRASH_DATA)
        if result:
            print(f"[PASS] Successfully converted validation-risk data.")
            print(f"       Name: {result.name}")
            print(f"       Description: {result.description}")
            print(f"       Deadline: {result.deadline}")
        else:
            print("[WARN] Dropped opportunity, but did not crash.")
    except Exception as e:
        print(f"[FAIL] Backend CRASHED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_backend_validation()
