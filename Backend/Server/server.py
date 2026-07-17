from flask import Flask, request, render_template, send_from_directory, Response
from os import path
# from waitress import serve as waitress_serve

app = Flask(__name__)

@app.route("/")
def hello_world():
    """docstring"""
    return render_template("index.html")

@app.route("/<path:filename>")
def show_page(filename:str):
    """Renders any html pages found in templates directory"""
    
    public_path = path.abspath(path.join("templates"))
    template_name = filename + ".html" if not filename.endswith(".html") else filename
    page_path = path.join(public_path,template_name)
    if path.abspath(page_path).startswith(public_path):
        if path.exists(path.abspath(page_path)):
            return render_template(template_name)
    return "<title>Error!</title><p>Page does not exist</p>"

@app.after_request
def add_coop_header(response):
    # Possible values: 'same-origin', 'same-origin-allow-popups', 'unsafe-none'
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    response.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'
    return response

if __name__ == "__main__":
    # run server on ::1 IPv6 address (localhost) so that chrome doesn't cry
    app.run("::1",port=5000,threaded=True,debug=True)
    # production server handler
    #waitress_serve(app,host="::1",port=5000,threads=6)
