#!/bin/bash
# ScholarStream Backend - macOS/Linux Dependency Installer
# بسم الله الرحمن الرحيم

echo "========================================"
echo "ScholarStream Backend Setup"
echo "========================================"
echo ""

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "❌ ERROR: Conda not found!"
    echo "Please install Miniconda from: https://docs.conda.io/en/latest/miniconda.html"
    exit 1
fi

echo "Step 1: Creating conda environment 'scholarstream'..."
conda create -n scholarstream python=3.11 -y
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to create conda environment"
    exit 1
fi

echo ""
echo "Step 2: Activating environment..."
source $(conda info --base)/etc/profile.d/conda.sh
conda activate scholarstream

echo ""
echo "Step 3: Installing Python dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to install dependencies"
    exit 1
fi

echo ""
echo "Step 4: Checking environment setup..."
if [ ! -f .env ]; then
    echo "⚠️  WARNING: .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "IMPORTANT: Please edit .env file with your actual credentials:"
    echo "  - Firebase credentials"
    echo "  - Gemini API key"
    echo "  - Upstash Redis URL and token"
    echo ""
fi

echo ""
echo "========================================"
echo "✅ Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit the .env file with your credentials"
echo "  2. Run: conda activate scholarstream"
echo "  3. Run: python run.py"
echo ""
echo "API will be available at: http://localhost:8000"
echo "API Docs will be at: http://localhost:8000/docs"
echo ""
