# TD Operator: /project1/start_exec (executeDAT)
# Enabled callbacks: onStart, onExit, onProjectPreSave
# Purpose: Manage the python3 HTTP server subprocess that serves the
#          Three.js lighting sim at http://localhost:8080.
#          Starts on project open, stops on project close or pre-save.

import subprocess

PROJ_DIR = '/Users/patrickhartono/Documents/myWork/ArtJog/artjog-lighting-sim'

def onStart():
    root = op('/project1')
    try:
        proc = subprocess.Popen(
            ['python3', '-m', 'http.server', '8080'],
            cwd=PROJ_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        root.store('http_proc', proc)
        print(f'[artjog] HTTP server started PID={proc.pid} → http://localhost:8080')
    except Exception as e:
        print(f'[artjog] HTTP server error: {e}')

def onExit():
    root = op('/project1')
    proc = root.fetch('http_proc', None)
    if proc:
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            proc.kill()
        root.unstore('http_proc')
        print('[artjog] HTTP server stopped')

def onProjectPreSave():
    # Must kill subprocess before save — TD cannot serialize Popen objects
    onExit()
