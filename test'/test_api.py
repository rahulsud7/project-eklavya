import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_docs_endpoint():
    """Verifies that the Swagger API documentation loads."""
    response = client.get("/docs")
    assert response.status_code == 200

def test_invalid_file_upload():
    """Ensures non-PDF uploads are rejected."""
    response = client.post(
        "/api/upload",
        data={"user_id": "test_user", "subject": "Science"},
        files={"file": ("test.txt", b"plain text content", "text/plain")}
    )
    assert response.status_code == 400
    assert "Only PDF files are currently supported" in response.json()["detail"]