import os
import vertexai
from vertexai.generative_models import GenerativeModel
from google.oauth2 import service_account

# Path to service account
sa_path = r"C:\Users\HP\Desktop\informant\informant-i4i-firebase-adminsdk-fbsvc-0c4b0be226.json"

try:
    credentials = service_account.Credentials.from_service_account_file(sa_path)
    vertexai.init(project="informant-i4i", location="us-central1", credentials=credentials)
    model = GenerativeModel("gemini-1.5-flash-001")
    response = model.generate_content("Hello! Are you working?")
    print("VERTEX AI SUCCESS:", response.text)
except Exception as e:
    print("VERTEX AI ERROR:", str(e))
