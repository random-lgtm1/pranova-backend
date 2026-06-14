import sys
import os
import argparse
import requests
from dotenv import load_dotenv

# Load env variables from .env file
load_dotenv()

def main():
    parser = argparse.ArgumentParser(description="Generate images using Hugging Face FLUX.1-schnell")
    parser.add_argument("--prompt", required=True, help="Prompt for image generation")
    parser.add_argument("--output", default="flux-schnell.png", help="Output file path")
    args = parser.parse_args()

    # Read token from env
    token = os.getenv("HF_TOKEN")
    
    API_URL = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"
    
    # Format Authorization header (Hugging Face standard)
    headers = {"Authorization": f"Bearer {token}"} 

    print(f"Sending prediction request for prompt: '{args.prompt}'...")
    try:
        response = requests.post(
            API_URL,
            headers=headers,
            json={"inputs": args.prompt},
            timeout=60
        )
        
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            with open(args.output, "wb") as f:
                f.write(response.content)
            print(f"Success! Image saved to {args.output}")
            sys.exit(0)
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            
            # Print treatment advice for 403/Forbidden
            if response.status_code == 403 or "permission" in response.text.lower():
                print("\n[TREATMENT ADVICE]")
                print("Your Hugging Face token lacks permission for Inference Providers.")
                print("Please create/update your Hugging Face Access Token at https://huggingface.co/settings/tokens")
                print("and make sure it has 'Inference' / 'Make calls to the serverless Inference API' permissions enabled.")
            sys.exit(1)
            
    except Exception as e:
        print(f"Request Error: {e}")
        print("Falling back to InferenceClient...")
        try:
            from huggingface_hub import InferenceClient
            client = InferenceClient(api_key=token)
            image = client.text_to_image(args.prompt, model="black-forest-labs/FLUX.1-schnell")
            image.save(args.output)
            print(f"Success via InferenceClient! Image saved to {args.output}")
            sys.exit(0)
        except Exception as client_err:
            print(f"InferenceClient fallback failed: {client_err}")
            sys.exit(1)

if __name__ == "__main__":
    main()
