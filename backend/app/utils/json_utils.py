import json
import re
import structlog
from typing import Any, Optional

logger = structlog.get_logger()

def robust_json_loads(text: str) -> Any:
    """
    Robustly load JSON from potentially messy AI output.
    Handles:
    1. Markdown code blocks (```json ... ```)
    2. Leading/trailing junk text
    3. Trailing commas in arrays/objects
    4. Common encoding issues
    """
    if not text:
        return None
        
    cleaned_text = text.strip()
    
    # 1. Strip Markdown Code Blocks
    if "```" in cleaned_text:
        # Match ```json ... ``` or just ``` ... ```
        match = re.search(r'```(?:json)?\s*(.*?)\s*```', cleaned_text, re.DOTALL)
        if match:
            cleaned_text = match.group(1).strip()
    
    # 2. Extract first array or object if there's still junk outside
    if not (cleaned_text.startswith('[') or cleaned_text.startswith('{')):
        # Try to find the start of the first array or object
        match = re.search(r'([\[\{].*[\]\}])', cleaned_text, re.DOTALL)
        if match:
            cleaned_text = match.group(1).strip()

    # 3. Clean Trailing Commas
    # Match a comma followed by whitespace and a closing bracket/brace
    cleaned_text = re.sub(r',\s*([\]\}])', r'\1', cleaned_text)
    
    # 4. Handle common nesting/line-break issues
    # Replace single quotes with double quotes only if they look like property keys
    # Note: This can be risky if content contains quotes, so we use a cautious regex
    # cleaned_text = re.sub(r"\'(\w+)\'\s*:", r'"\1":', cleaned_text)

    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError as e:
        logger.error("Robust JSON load failed", error=str(e), text_sample=cleaned_text[:200])
        # Last resort: Try simple manual fixes for very common issues
        try:
             # Try replacing single quotes with double quotes globally if it fails
             # Extremely risky, but sometimes needed for poor AI outputs
             alt_text = cleaned_text.replace("'", '"')
             return json.loads(alt_text)
        except:
             raise e # Re-raise original error if even fallback fails
