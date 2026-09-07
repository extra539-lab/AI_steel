import os
import uvicorn

PORT = int(os.getenv('PORT', os.getenv('BACKEND_PORT', 8005)))

if __name__ == "__main__":
    print(f"Starting A1 Steel & Cement Backend on port {PORT}...")
    uvicorn.run("app.main:app", host="127.0.0.1", port=PORT, reload=False)
