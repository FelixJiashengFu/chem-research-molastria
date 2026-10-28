"""Optional online refresh. Run with a virtual environment after installing requirements."""
from pathlib import Path
import subprocess
import sys
from merge_data import build

if __name__ == '__main__':
    here = Path(__file__).resolve().parent
    subprocess.run([sys.executable, str(here / 'crawler.py'), *sys.argv[1:]], cwd=here, check=True)
    build()
    print('Updated Hub snapshot, merged catalogue, and offline data scripts. Reload the browser to see changes.')
