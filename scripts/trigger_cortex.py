
import asyncio
import sys
import os
import structlog
from datetime import datetime

# Add dashboard backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.cortex.navigator import sentinel, scout
from app.services.kafka_config import kafka_producer_manager

logger = structlog.get_logger()

async def trigger_cortex():
    print("🤖 TERMINAL: Triggering Cortex Agents for Manual Verification")
    print("===========================================================")

    # 1. Trigger Sentinel (Proactive Patrol)
    print("\n[1] 🛡️  SENTINEL: Starting Patrol of Trusted Hubs...")
    try:
        # Check if browser launches (Stealth Mode)
        await sentinel.initialize()
        print("   ✅ Sentinel Initialized (Stealth Browser Running)")
        
        # Run a quick patrol (Limited by the loop inside sentinel, usually)
        # We will wrap it with a timeout so it doesn't run forever if patrol is infinite
        try:
            await asyncio.wait_for(sentinel.patrol(), timeout=30)
        except asyncio.TimeoutError:
             print("   ⚠️  Patrol Timed Out (Expected for Infinite Scroll tests)")
        
        print("   ✅ Sentinel Finished Patrol. Check Kafka/Console logs for 'Streamed raw HTML'.")
        await sentinel.shutdown()
        
    except Exception as e:
        print(f"   ❌ Sentinel Failed: {e}")

    # 2. Trigger Scout (Reactive Search)
    print("\n[2] 🦅 SCOUT: Dispatching Mission 'Python Hackathons'...")
    try:
        await scout.initialize()
        results = await scout.execute_mission("Remote Python Hackathons 2025")
        
        print(f"   ✅ Scout Returned {len(results)} results.")
        for res in results:
            print(f"      - Visited: {res.get('url')}")
            
        await scout.shutdown()
        
    except Exception as e:
        print(f"   ❌ Scout Failed: {e}")

    print("\n===========================================================")
    print("Check your 'backend' terminal logs. If you see 'Received enriched opportunity', the pipeline worked!")

if __name__ == "__main__":
    asyncio.run(trigger_cortex())
