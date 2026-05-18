"""
Unit Tests for Personalization Engine
FAANG-Level: Comprehensive test coverage
"""
import pytest
from app.services.personalization_engine import personalization_engine
from app.models import UserProfile


class TestPersonalizationEngine:
    """Test suite for personalization engine"""
    
    def test_interest_matching_high_score(self):
        """Test that AI interest matches AI opportunity"""
        profile = UserProfile(
            name="Test User",
            email="test@example.com",
            interests=['artificial intelligence', 'machine learning']
        )
        
        opportunity = {
            'name': 'AI Hackathon',
            'description': 'Build machine learning models using deep learning and neural networks',
            'tags': ['AI', 'ML', 'hackathon'],
            'eligibility': {},
            'requirements': {}
        }
        
        score = personalization_engine._score_interests(opportunity, profile)
        
        assert score > 70, f"Expected high interest score, got {score}"
    
    def test_interest_matching_low_score(self):
        """Test that unrelated interests get low score"""
        profile = UserProfile(
            name="Test User",
            email="test@example.com",
            interests=['game development']
        )
        
        opportunity = {
            'name': 'Fintech Scholarship',
            'description': 'For students interested in banking and financial technology',
            'tags': ['finance', 'fintech'],
            'eligibility': {},
            'requirements': {}
        }
        
        score = personalization_engine._score_interests(opportunity, profile)
        
        assert score < 60, f"Expected low interest score, got {score}"
    
    def test_passion_alignment(self):
        """Test passion matching"""
        profile = UserProfile(
            name="Test User",
            email="test@example.com",
            interests=[],
            background=['social impact', 'education']
        )
        
        opportunity = {
            'name': 'Education Technology Hackathon',
            'description': 'Build solutions for nonprofit education organizations',
            'tags': ['education', 'social good'],
            'eligibility': {},
            'requirements': {}
        }
        
        score = personalization_engine._score_passions(opportunity, profile)
        
        assert score > 70, f"Expected high passion score, got {score}"
    
    def test_demographic_matching_gpa(self):
        """Test GPA demographic matching"""
        profile = UserProfile(
            name="Test User",
            email="test@example.com",
            gpa=3.8
        )
        
        opportunity = {
            'name': 'Merit Scholarship',
            'description': 'For high-achieving students',
            'eligibility': {
                'gpa_min': 3.5
            },
            'requirements': {}
        }
        
        score = personalization_engine._score_demographics(opportunity, profile)
        
        assert score >= 90, f"Expected high demographic score for GPA match, got {score}"
    
    def test_demographic_matching_major(self):
        """Test major demographic matching"""
        profile = UserProfile(
            name="Test User",
            email="test@example.com",
            major='Computer Science'
        )
        
        opportunity = {
            'name': 'CS Scholarship',
            'description': 'For computer science students',
            'eligibility': {
                'majors': ['Computer Science', 'Software Engineering']
            },
            'requirements': {}
        }
        
        score = personalization_engine._score_demographics(opportunity, profile)
        
        assert score >= 90, f"Expected high demographic score for major match, got {score}"
    
    def test_full_personalization_score(self):
        """Test complete personalization pipeline"""
        profile = UserProfile(
            name="Test User",
            email="test@example.com",
            interests=['artificial intelligence', 'web development'],
            major='Computer Science',
            gpa=3.8,
            background=['social impact']
        )
        
        # High-match opportunity
        high_match_opp = {
            'name': 'AI for Social Good Hackathon',
            'description': 'Build AI and web applications for nonprofit organizations using machine learning',
            'tags': ['AI', 'web', 'social impact'],
            'eligibility': {
                'gpa_min': 3.0,
                'majors': ['Computer Science']
            },
            'requirements': {}
        }
        
        score = personalization_engine.calculate_personalized_score(high_match_opp, profile)
        
        assert score > 70, f"Expected high personalization score, got {score}"
        assert score >= 30, "Score should have minimum baseline"
        assert score <= 99, "Score should be capped at 99"
    
    def test_low_match_opportunity(self):
        """Test that unrelated opportunity gets lower score"""
        profile = UserProfile(
            name="Test User",
            email="test@example.com",
            interests=['game development'],
            major='Game Design',
            gpa=3.5
        )
        
        low_match_opp = {
            'name': 'Finance Scholarship',
            'description': 'For students pursuing careers in banking and investment',
            'tags': ['finance', 'banking'],
            'eligibility': {
                'gpa_min': 3.0,
                'majors': ['Finance', 'Economics']
            },
            'requirements': {}
        }
        
        score = personalization_engine.calculate_personalized_score(low_match_opp, profile)
        
        assert score < 60, f"Expected low score for unrelated opportunity, got {score}"
    
    def test_baseline_score_minimum(self):
        """Test that all scores have minimum baseline"""
        profile = UserProfile(
            name="Test User",
            email="test@example.com",
            interests=[]
        )
        
        opportunity = {
            'name': 'Generic Opportunity',
            'description': 'Some opportunity',
            'eligibility': {},
            'requirements': {}
        }
        
        score = personalization_engine.calculate_personalized_score(opportunity, profile)
        
        assert score >= 30, f"Expected minimum baseline score of 30, got {score}"
    
    def test_get_explanation(self):
        """Test match explanation generation"""
        profile = UserProfile(
            name="Test User",
            email="test@example.com",
            interests=['artificial intelligence'],
            major='Computer Science',
            gpa=3.8
        )
        
        opportunity = {
            'name': 'AI Scholarship',
            'description': 'For students studying machine learning',
            'eligibility': {
                'gpa_min': 3.5,
                'majors': ['Computer Science']
            },
            'requirements': {}
        }
        
        explanation = personalization_engine.get_explanation(opportunity, profile)
        
        assert len(explanation) > 0, "Explanation should not be empty"
        assert 'artificial intelligence' in explanation.lower() or 'interests' in explanation.lower()


# Run tests
if __name__ == '__main__':
    pytest.main([__file__, '-v'])
