# SprintOne_DnDProject


# GnollPointer

This project is a website that allows users to keep track of multiple things for any TTRPG system. It involves a tree-type structure to modularly edit and create modifiers, replacement values, items, equipment, etc. 

## Instructions for Build and Use

Steps to build and/or run the software:

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


Instructions for using the software:

1. Select Edit Mode button on the Character sheet page to edit values and add containers/items
2. Add items to the containers and play around with changing the numbers
3. The website will automatically update connected variables to keep track of stats, items, modifiers, etc.

## Development Environment

To recreate the development environment, you need the following software and/or libraries with the specified versions:

* Python 
* Working web browser, such as Chrome or Firefox
* VisualStudio

## Useful Websites to Learn More

I found these websites useful in developing this software:

* [w3Schools](https://www.w3schools.com/)
* [5etools] (https://2014.5e.tools/)
* [Roll20] (https://roll20.net/)

## Future Work

The following items I plan to fix, improve, and/or add to this project in the future:

* [ ] Add ability for a party to view each other's character sheets
* [ ] Include macros for different RPG systems
* [ ] Include dropdowns for icons to assign to boxes

