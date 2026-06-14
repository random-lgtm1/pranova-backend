import sys
import json
import chromadb
import uuid

def get_client():
    return chromadb.PersistentClient(path="./my_ai_data")

def get_collection(client, email):
    # Sanitize email to make a valid collection name
    # Collection names must be 3-63 chars, start/end with alphanumeric, only alphanumeric, underscores, hyphens.
    sanitized = "".join([c if c.isalnum() or c in ['_', '-'] else '_' for c in email]).lower()
    if len(sanitized) < 3:
        sanitized = "usr_" + sanitized
    sanitized = sanitized[:63]
    # Ensure starting/ending with alphanumeric
    if not sanitized[0].isalnum():
        sanitized = "u" + sanitized[1:]
    if not sanitized[-1].isalnum():
        sanitized = sanitized[:-1] + "r"
    return client.get_or_create_collection(name=sanitized)

def add_fact(email, document):
    client = get_client()
    collection = get_collection(client, email)
    doc_id = str(uuid.uuid4())
    collection.add(
        documents=[document],
        ids=[doc_id]
    )
    print(json.dumps({"success": True, "id": doc_id}))

def query_facts(email, query_text):
    client = get_client()
    collection = get_collection(client, email)
    
    if collection.count() == 0:
        print(json.dumps({"success": True, "documents": []}))
        return
        
    results = collection.query(
        query_texts=[query_text],
        n_results=3
    )
    # Extract documents
    documents = results.get('documents', [[]])[0]
    print(json.dumps({"success": True, "documents": documents}))

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Insufficient arguments"}))
        sys.exit(1)
        
    action = sys.argv[1]
    email = sys.argv[2]
    
    if action == "add":
        fact = sys.argv[3]
        add_fact(email, fact)
    elif action == "query":
        query = sys.argv[3]
        query_facts(email, query)
    else:
        print(json.dumps({"success": False, "error": "Invalid action"}))
