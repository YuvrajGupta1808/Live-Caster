import os
import google.generativeai as genai
from dotenv import load_dotenv

def test_api_key():
    # Load environment variables
    load_dotenv()
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in environment variables.")
        return

    print(f"API Key found: {api_key[:4]}...{api_key[-4:]}")

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        print("Attempting to generate content with gemini-flash-latest...")
        response = model.generate_content("Hello! If you can read this, say 'API Key is working!'")
        
        print("\nResponse from Gemini:")
        print("-" * 20)
        print(response.text)
        print("-" * 20)
        print("\nSuccess! The API key is valid and working.")
        
    except Exception as e:
        print(f"\nError: Failed to connect to Gemini API.")
        print(f"Details: {e}")

if __name__ == "__main__":
    test_api_key()

