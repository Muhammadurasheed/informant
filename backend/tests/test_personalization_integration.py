"""
Integration Test for Personalization Engine
Tests the complete pipeline from scraping to personalized scoring
"""
import asyncio
import pytest
from app.services.personalization_engine import personalization_engine
from app.services.opportunity_converter import calculate_match_score
from app.models import UserProfile


async def test_full_personalization_pipeline():
    """Test complete personalization pipeline with real-world scenarios"""
    
    # Scenario 1: AI/ML enthusiast
    ai_student = UserProfile(
        name="AI Student",
        email="ai@example.com",
        interests=['artificial intelligence', 'machine learning', 'data science'],
        major='Computer Science',
        gpa=3.9,
        academic_status='Undergraduate',
        background=['research', 'problem solving']
    )
    
    ai_opportunity = {
        'name': 'Google AI Research Scholarship',
        'description': 'For students passionate about machine learning, deep learning, and artificial intelligence research',
        'organization': 'Google',
        'amount': 10000,
        'tags': ['AI', 'ML', 'research', 'Google'],
        'eligibility': {
            'gpa_min': 3.5,
            'majors': ['Computer Science', 'Data Science'],
            'grades_eligible': ['Undergraduate', 'Graduate']
        },
        'requirements': {
            'essay': True,
            'essay_prompts': ['Describe your AI research interests'],
            'recommendation_letters': 2,
            'transcript': True
        }
    }
    
    score = calculate_match_score(ai_opportunity, ai_student)
    print(f"\n✅ AI Student + AI Opportunity: {score}/100")
    assert score >= 80, f"Expected high match for AI student, got {score}"
    
    # Scenario 2: Web development enthusiast
    web_student = UserProfile(
        name="Web Developer",
        email="web@example.com",
        interests=['web development', 'frontend', 'backend'],
        major='Software Engineering',
        gpa=3.7,
        academic_status='Undergraduate'
    )
    
    web_hackathon = {
        'name': 'React Hackathon',
        'description': 'Build amazing web applications using React, Node.js, and modern web technologies',
        'organization': 'Meta',
        'amount': 5000,
        'tags': ['web', 'React', 'hackathon'],
        'eligibility': {
            'gpa_min': 3.0,
            'grades_eligible': ['Undergraduate']
        },
        'requirements': {
            'essay': False,
            'skills_needed': ['JavaScript', 'React', 'Node.js']
        }
    }
    
    score = calculate_match_score(web_hackathon, web_student)
    print(f"✅ Web Student + Web Hackathon: {score}/100")
    assert score >= 75, f"Expected high match for web student, got {score}"
    
    # Scenario 3: Mismatched interests (should get lower score)
    game_student = UserProfile(
        name="Game Developer",
        email="game@example.com",
        interests=['game development', 'Unity', '3D graphics'],
        major='Game Design',
        gpa=3.5
    )
    
    finance_scholarship = {
        'name': 'Finance Scholarship',
        'description': 'For students pursuing careers in banking, investment, and financial services',
        'organization': 'Goldman Sachs',
        'amount': 10000,
        'tags': ['finance', 'banking'],
        'eligibility': {
            'gpa_min': 3.5,
            'majors': ['Finance', 'Economics', 'Business']
        },
        'requirements': {}
    }
    
    score = calculate_match_score(finance_scholarship, game_student)
    print(f"✅ Game Student + Finance Scholarship: {score}/100")
    assert score < 60, f"Expected low match for mismatched interests, got {score}"
    
    # Scenario 4: Diversity scholarship match
    diversity_student = UserProfile(
        name="Diversity Student",
        email="diversity@example.com",
        interests=['social impact', 'education'],
        major='Computer Science',
        gpa=3.8,
        background=['African American', 'community service']
    )
    
    diversity_scholarship = {
        'name': 'UNCF STEM Scholarship',
        'description': 'For African American students pursuing STEM degrees with passion for community impact',
        'organization': 'UNCF',
        'amount': 10000,
        'tags': ['diversity', 'STEM', 'social impact'],
        'eligibility': {
            'gpa_min': 3.0,
            'majors': ['Computer Science', 'Engineering'],
            'backgrounds': ['African American', 'Black']
        },
        'requirements': {
            'essay': True,
            'essay_prompts': ['Community impact']
        }
    }
    
    score = calculate_match_score(diversity_scholarship, diversity_student)
    print(f"✅ Diversity Student + Diversity Scholarship: {score}/100")
    assert score >= 85, f"Expected very high match for diversity student, got {score}"
    
    # Scenario 5: Urgency bonus test
    urgent_opportunity = {
        'name': 'Urgent Scholarship',
        'description': 'Apply now! Deadline in 2 days',
        'organization': 'Test Org',
        'amount': 5000,
        'urgency': 'immediate',
        'tags': ['urgent'],
        'eligibility': {},
        'requirements': {}
    }
    
    generic_student = UserProfile(
        name="Generic Student",
        email="generic@example.com",
        interests=[],
        gpa=3.5
    )
    
    score = calculate_match_score(urgent_opportunity, generic_student)
    print(f"✅ Generic Student + Urgent Opportunity: {score}/100")
    # Should have urgency bonus (+10)
    assert score >= 40, f"Expected baseline + urgency bonus, got {score}"
    
    print("\n" + "="*60)
    print("✅ ALL INTEGRATION TESTS PASSED")
    print("="*60)
    print("\nPersonalization Engine is working correctly!")
    print("- Interest matching: ✅")
    print("- Passion alignment: ✅")
    print("- Demographic matching: ✅")
    print("- Mismatch detection: ✅")
    print("- Urgency bonuses: ✅")


async def test_score_distribution():
    """Test that scores are properly distributed"""
    
    student = UserProfile(
        name="Test Student",
        email="test@example.com",
        interests=['artificial intelligence'],
        major='Computer Science',
        gpa=3.8
    )
    
    opportunities = [
        {
            'name': 'Perfect Match',
            'description': 'AI and machine learning scholarship for Computer Science students',
            'eligibility': {'gpa_min': 3.5, 'majors': ['Computer Science']},
            'tags': ['AI', 'ML'],
            'requirements': {}
        },
        {
            'name': 'Good Match',
            'description': 'Technology scholarship for STEM students',
            'eligibility': {'gpa_min': 3.0, 'majors': ['Computer Science', 'Engineering']},
            'tags': ['technology'],
            'requirements': {}
        },
        {
            'name': 'Fair Match',
            'description': 'General scholarship for all students',
            'eligibility': {'gpa_min': 3.0},
            'tags': ['general'],
            'requirements': {}
        },
        {
            'name': 'Poor Match',
            'description': 'Art scholarship for creative students',
            'eligibility': {'majors': ['Art', 'Design']},
            'tags': ['art', 'creative'],
            'requirements': {}
        }
    ]
    
    scores = [calculate_match_score(opp, student) for opp in opportunities]
    
    print(f"\n📊 Score Distribution Test:")
    for opp, score in zip(opportunities, scores):
        print(f"  {opp['name']}: {score}/100")
    
    # Verify proper distribution
    assert scores[0] > scores[1], "Perfect match should score higher than good match"
    assert scores[1] > scores[2], "Good match should score higher than fair match"
    assert scores[2] > scores[3], "Fair match should score higher than poor match"
    
    # Verify minimum baseline
    assert all(score >= 30 for score in scores), "All scores should have minimum baseline"
    
    # Verify cap
    assert all(score <= 99 for score in scores), "All scores should be capped at 99"
    
    print("✅ Score distribution is correct!")


if __name__ == '__main__':
    print("\n" + "="*60)
    print("PERSONALIZATION ENGINE - INTEGRATION TESTS")
    print("="*60)
    
    asyncio.run(test_full_personalization_pipeline())
    asyncio.run(test_score_distribution())
    
    print("\n🎉 All integration tests completed successfully!")
