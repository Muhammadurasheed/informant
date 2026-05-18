
import urllib.request
import json
import sys

URL = "http://localhost:8000/api/extension/map-fields"

# Mock Payload for Extension Auto-Fill
PAYLOAD = {
    "form_fields": [
        {
            "id": "full_name",
            "name": "fullname",
            "label": "Full Name",
            "type": "text",
            "placeholder": "John Doe",
            "selector": "#full_name"
        },
        {
            "id": "essay_q1",
            "name": "essay",
            "label": "Why do you want to attend this hackathon?",
            "type": "textarea",
            "placeholder": "Tell us about yourself...",
            "selector": "#essay_q1"
        }
    ],
    "user_profile": {
        "full_name": "Test User",
        "email": "test@example.com",
        "interests": ["Hackathons", "AI"],
        "essays": {
            "personal_statement": "I love building cool things with code!"
        }
    }
}

def test_extension_api():
    print(f">> Testing Extension API: {URL}")
    req = urllib.request.Request(URL)
    req.add_header('Content-Type', 'application/json')
    req.add_header('Authorization', 'Bearer TEST_TOKEN') # Use the Bypass I added
    
    body = json.dumps(PAYLOAD).encode('utf-8')
    
    try:
        with urllib.request.urlopen(req, data=body) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                print("[PASS] API returned 200 OK")
                print(">> Response Data:")
                print(json.dumps(data, indent=2))
                
                # Verify logic
                mappings = data.get('field_mappings', {})
                if mappings:
                    print(f"[PASS] Received {len(mappings)} field mappings.")
                    if '#full_name' in mappings:
                        print(f"       Mapped Name: {mappings['#full_name']}")
                else:
                    print("[WARN] No mappings returned (AI might be conservative or unresponsive).")
            else:
                print(f"[FAIL] API returned Status {response.status}")
                print(response.read().decode('utf-8'))
                
    except urllib.error.URLError as e:
        print(f"[FAIL] connection failed: {e}")
        print("       Ensure backend is running on localhost:8000")
    except Exception as e:
        print(f"[FAIL] Unexpected error: {e}")

if __name__ == "__main__":
    test_extension_api()
