import requests
import base64
import os

# Configuration
BASE_URL = "http://localhost:8000"
TEST_IMAGE_PATH = "test-img.png"  # We'll need a dummy image

def get_image_data():
    if not os.path.exists(TEST_IMAGE_PATH):
        print(f"❌ Error: Test image not found at {TEST_IMAGE_PATH}")
        return None
        
    with open(TEST_IMAGE_PATH, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def test_analyze_endpoint():
    print("Testing /analyze endpoint...")
    
    image_b64 = get_image_data()
    if not image_b64:
        return

    payload = {
        "image": image_b64,
        "skip_audio": True
    }
    
    try:
        response = requests.post(f"{BASE_URL}/analyze", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Success!")
            print(f"Commentary: {data.get('text')}")
            if data.get('audio'):
                print("Audio received (base64)")
            else:
                print("⚠️ No audio received")
        else:
            print(f"❌ Failed with status code: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection refused. Is the backend server running?")

if __name__ == "__main__":
    test_analyze_endpoint()
