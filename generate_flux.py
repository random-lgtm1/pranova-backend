import sys
import os
import argparse
import json
import urllib.request
import urllib.error

def main():
    parser = argparse.ArgumentParser(description="Generate images using Hugging Face FLUX.1-schnell")
    parser.add_argument("--prompt", required=True, help="Prompt for image generation")
    parser.add_argument("--output", default="flux-schnell.png", help="Output file path")
    args = parser.parse_args()

    # Read token from env
    token = os.getenv("HF_TOKEN")
    
    API_URL = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"
    
    # Format headers
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    } 

    print(f"Sending prediction request for prompt: '{args.prompt}'...")
    try:
        # Construct POST request using standard urllib
        req = urllib.request.Request(
            API_URL,
            data=json.dumps({"inputs": args.prompt}).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=60) as response:
            status_code = response.status
            content = response.read()
            
            print(f"Response Status: {status_code}")
            
            if status_code == 200:
                with open(args.output, "wb") as f:
                    f.write(content)
                print(f"Success! Image saved to {args.output}")
                sys.exit(0)
            else:
                print(f"Error: {status_code}")
                sys.exit(1)
                
    except urllib.error.HTTPError as e:
        status_code = e.code
        error_text = e.read().decode("utf-8")
        print(f"Error: {status_code}")
        print(error_text)
        
        # Print treatment advice for 403/Forbidden
        if status_code == 403 or "permission" in error_text.lower():
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
