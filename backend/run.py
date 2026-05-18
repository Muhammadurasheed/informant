import uvicorn
import socket
import sys
import os
import subprocess
import time
from dotenv import load_dotenv

# Load env vars first
load_dotenv()

def is_socket_bindable(host: str, port: int) -> bool:
    """
    Explicitly try to BIND to the port to see if OS has released it.
    This is stricter than just checking for existence.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        # Set REUSEADDR to prevent TIME_WAIT hangs
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, port))
        sock.close()
        return True
    except OSError:
        return False

def nuclear_port_clear(port: int):
    """
    The 'Nuclear Option'.
    Repeatedly kills process and WAITS until socket is bindable.
    """
    print(f"[INFO] Checking Port {port} availability...")
    
    # 1. Check if bindable immediately
    if is_socket_bindable("0.0.0.0", port):
        print("[INFO] Port is free and bindable.")
        return

    print(f"[WARN] Port {port} is occupied. Engaging Nuclear Cleanup Protocol.")
    
    max_retries = 5
    for attempt in range(max_retries):
        # Find PIDs
        try:
            result = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True).decode()
            pids = set()
            for line in result.strip().split('\n'):
                parts = line.split()
                if f":{port}" in parts[1]:
                    pid = parts[-1]
                    if pid.isdigit() and int(pid) > 0:
                        pids.add(int(pid))
            
            if pids:
                print(f"[INFO] Kill Attempt {attempt+1}: found PIDs {pids}")
                for pid in pids:
                    # Windows taskkill /F /PID <pid>
                    subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
        except Exception:
            pass # Netstat error means no PID found (good)

        # WAIT logic
        print(f"[INFO] Waiting for socket release (Attempt {attempt+1})...")
        time.sleep(2)
        
        if is_socket_bindable("0.0.0.0", port):
            print("[INFO] Socket successfully released!")
            return
            
    print("[ERROR] CRITICAL: OS refuses to release port even after killing processes.")
    print("[ERROR] This usually means a permission error or a system-level zombie.")
    sys.exit(1)

if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 8081))
    
    # 1. Run Nuclear Cleanup
    try:
        nuclear_port_clear(PORT)
    except KeyboardInterrupt:
        sys.exit(0)

    print("[INFO] Environment variables loaded from .env")
    print("==> Starting Informant FastAPI Backend...")
    print(f"==> Server will run at: http://localhost:{PORT}")
    print("==> Auto-reload DISABLED for stability")

    # 2. Start Uvicorn
    # Use 127.0.0.1 if 0.0.0.0 causes permission issues on some Windows setups
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=PORT, 
        reload=False, 
        workers=1,
        log_level="info"
    )
