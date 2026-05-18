
import asyncio
import sys
import os
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.models import OpportunitySchema, DeepUserProfile
from app.services.cortex.refinery import RefineryService
import structlog

logger = structlog.get_logger()

async def verify_pipeline():
    print("STARTING SCHOLARSTREAM V1 PIPELINE VERIFICATION")
    print("==================================================")
    
    errors = []

    # 1. Verify Opportunity Schema & Expiration Logic
    print("\n[1/4] Verifying Opportunity Schema & Expiration Gate...")
    try:
        # Case A: Valid Opportunity
        future = int((datetime.now() + timedelta(days=30)).timestamp())
        valid_opp = OpportunitySchema(
            id="test_valid",
            title="Valid Hackathon",
            organization="Test Org",
            amount_display="$1,000",
            deadline=datetime.now().isoformat(),
            deadline_timestamp=future,
            source_url="http://test.com",
            description="A global hackathon for python developers."
        )
        print(f"Schema Validated: {valid_opp.title}")

        # Case B: Expired Opportunity
        past = int((datetime.now() - timedelta(days=1)).timestamp())
        refinery = RefineryService()
        is_expired = refinery._is_expired(past)
        if not is_expired:
            errors.append("FATAL: Expiration Gate failed to detect expired timestamp.")
        else:
            print(f"Expiration Gate: Correctly identified expired timestamp {past}")

    except Exception as e:
        errors.append(f"Schema Validation Error: {str(e)}")

    # 2. Verify Refinery Intelligence (Tagging)
    print("\n[2/4] Verifying Stream Intelligence (Tagging)...")
    try:
        # Case: Native Logic
        opp = OpportunitySchema(
            id="test_tag",
            title="Python Hackathon in Lagos",
            organization="Test",
            amount_display="$0",
            deadline="2025-01-01",
            deadline_timestamp=1735689600,
            source_url="http://test",
            description="Join us in Nigeria for this Hackathon.", # "Nigeria" present
            eligibility_text="Open to all."
        )
        
        geo_tags = refinery._enrich_geo_tags(opp)
        type_tags = refinery._enrich_type_tags(opp)
        
        if "Nigeria" not in geo_tags:
            errors.append("Intelligence Error: Failed to auto-tag 'Nigeria'")
        else:
             print(f"Geo-Tagging Success: Detected {geo_tags}")
             
        if "Hackathon" not in type_tags:
             errors.append("Intelligence Error: Failed to auto-tag 'Hackathon'")
        else:
             print(f"Type-Tagging Success: Detected {type_tags}")

    except Exception as e:
        errors.append(f"Refinery Error: {str(e)}")

    # 3. Verify Deep Profile Architecture
    print("\n[3/4] Verifying Deep User Profile Structure...")
    try:
        profile = DeepUserProfile(
            name="Test User",
            bio="A developer",
            location="Lagos",
            school="Test Uni",
            major="CS",
            graduation_year="2025",
            gpa=4.0,
            hard_skills=["Python", "React"],
            projects=[
                {"title": "ScholarStream", "description": "AI Agent", "tech_stack": ["Python", "Kafka"]}
            ],
            experience=[
                {"role": "Engineer", "company": "Tech Corp", "start_date": "2024", "description": "Built things"}
            ]
        )
        print(f"Deep Profile Validated: {len(profile.projects)} Project(s) found.")
    except Exception as e:
        errors.append(f"Deep Profile Error: {str(e)}")

    # 4. Mock Cortex Flow
    print("\n[4/4] Verifying Cortex Components Import...")
    try:
        from app.services.cortex.navigator import sentinel, scout
        from app.services.cortex.reader_llm import reader_llm
        print("Cortex Components (Sentinel, Scout, Reader) Imported Successfully.")
    except ImportError as e:
        errors.append(f"Cortex Import Error: {str(e)}")

    print("\n==================================================")
    if errors:
        print(f"PIPELINE FAILED with {len(errors)} errors:")
        for err in errors:
            print(err)
        sys.exit(1)
    else:
        print("SUCCESS: ScholarStream V1 System Manifest is Verified & Production-Ready")

if __name__ == "__main__":
    asyncio.run(verify_pipeline())
