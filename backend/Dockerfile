# Backend Dockerfile with Playwright Support

# Use official Python slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# Install system dependencies required for build and Playwright
# We need curl/wget to install browsers if needed, and basic build tools
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (Chromium only to save space/time, add others if needed)
# --with-deps installs OS dependencies for the browsers
RUN playwright install --with-deps chromium

# Copy application code
COPY app ./app

# Expose the port
EXPOSE 8080

# Command to run the application using Uvicorn
# We use shell form to expand ${PORT}
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
