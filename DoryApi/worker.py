import multiprocessing
import subprocess
import sys
import os

def run_script(script_name):
    script_path = os.path.join(os.path.dirname(__file__), script_name)
    subprocess.run([sys.executable, script_path])

if __name__ == "__main__":
    processes = []
    for script in ["mqtt_heartbeat_listener.py", "mqtt_sync_listener.py"]:
        p = multiprocessing.Process(target=run_script, args=(script,))
        p.start()
        processes.append(p)
    for p in processes:
        p.join()
