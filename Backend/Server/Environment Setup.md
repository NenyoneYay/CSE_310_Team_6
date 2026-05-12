# Environment Setup Guide for the Server
## Setup Environment for Localhost
1. **Setup** a python virtual environment (venv) by running the following command **inside the "Server" directory**: 
    - `python -m venv .venv`
2. **Activate** the venv by running one of the commands:
    - **Windows cmd:** `.venv\Scripts\activate`
    - **Windows PS:** `.venv\Scripts\activate.ps1`
    - **Mac OS/Linux:** `.venv/bin/activate`
3. **Install** required packages: 
    - `pip install -r requirements.txt`
3. **Run** the "server.py" python file:
    - `python server.py`

Full commands list for windows PS:
```powershell
python -m venv .venv
.venv\Scripts\activate.ps1
pip install -r requirements.txt
python server.py
```

## Post setup activation (localhost)
Just don't remake the venv or install requirements again:
```powershell
.venv\Scripts\activate.ps1
python server.py
```
