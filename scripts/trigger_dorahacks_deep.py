"""
Trigger DoraHacks Deep Scrape

Run this script to scrape DoraHacks hackathons with accurate prize pools and deadlines.
This uses the deep scraper that visits individual detail pages.

Usage:
    python scripts/trigger_dorahacks_deep.py
"""
import asyncio
import sys
import os

# Add backend to path and load environment variables
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_dir)

try:
    from dotenv import load_dotenv
    env_path = os.path.join(backend_dir, '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"Loaded environment from {env_path}")
    else:
        print(f"Warning: .env not found at {env_path}")
except ImportError:
    print("Warning: python-dotenv not installed, assuming env vars are set.")

from app.services.scrapers.dorahacks_scraper import run_dorahacks_deep_scrape


async def main():
    print("DoraHacks Deep Scraper Starting...")
    print("=" * 50)
    print("This will visit individual hackathon pages to extract")
    print("accurate prize pools and deadlines.")
    print("=" * 50)
    
    try:
        opportunities = await run_dorahacks_deep_scrape(max_hackathons=15)
        
        print("\n" + "=" * 50)
        print(f"SUCCESS: Extracted {len(opportunities)} opportunities")
        print("=" * 50)
        
        for i, opp in enumerate(opportunities, 1):
            prize = opp.get('amount_display', '$0')
            deadline = opp.get('deadline', 'TBD')
            name = opp.get('title', 'Unknown')[:40]
            print(f"{i}. {name}... | Prize: {prize} | Deadline: {deadline}")
            
        print("\nData published to Kafka stream. Check your dashboard!")
        
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
