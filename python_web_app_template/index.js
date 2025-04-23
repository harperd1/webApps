// Copy/paste your own python code here
// Your code must include a function called "js_entry point", follow the example shown here
// Warning, if your function includes an "if __name__=='main'" function or directly executes code,
//// pyiodide will try to execute that code instead of just defining a function for the browser to use
const pythonCode = `
def calculateResultFromData(files,output_path):
    fil = open(output_path, 'w')
    fil.write('example output')
    fil.close
    return [output_path]

def js_entry_point(file_path_array, output_path='/results.txt'):
    #file_path_array is a list of strings, each string is the path to a file that was uploaded using the choose files GamepadButton
    #arguments passed from javascript often come in poorly formatted
    #### for simple data types, like integers, this can often be fixed with code like this: argument = int(argument)
    #### for more complicated data types, like lists, we need to use the pyodide function pyodide.toPy() to convert the javascript object to a python object
    file_path_array = file_path_array.to_py()
    return calculateResultFromData(file_path_array,output_path=output_path)
`

function add_paragraph(text) {
    let para = document.createElement("p");
    para.innerHTML = text;
 
    let element = document.getElementById("main");
    element.appendChild(para);
}

function download(file) {
    const link = document.createElement('a')
    const url = URL.createObjectURL(file)

    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()

    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

async function setupPython(pyodide) {
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
 
    // Before importing a package in python, we have to install it in the pyodide environemnt
    // We have two options to do this
    // For common packages and if we are using the cdn version of pyiodide (see index.html), we may be able to just use their name
    // For example, pyiodide makes numpy available by default
    // If using this file as a template, comment out the unused packages

    // await micropip.install('numpy')
    // await micropip.install('pandas')
    // await micropip.install('scipy')
    // await micropip.install('scikit-learn')
    // await micropip.install('matplotlib')
    // await micropip.install('Pillow')
    // await micropip.install('networkx')

    // For less common packages, we need to point a a .whl file
    // Note: This will only work for pure-python packages.
    //// For packages with c bindings (like numpy and pandas), we need to use the pyiodide versions because OS matters and the broswer python interpretter is a strange case
    // The easiest way to find paths to .whl files is to go to pypi.org, search the package, go to "Download Files", right click the .whl file under "Built Distribution" and select "Copy link address"

    // Load the custom python code included in this app
    // The code should include a function called "js_entry_point(arg)"
    //// This function should take one argument
    ////// The path to read the file we will manipulate from (as a string)
    //// If the function takes additional arguments, there will need to be html inputs (such as sliders) to specify those values
    ////// The additional arguments need some custom handling in pass_files_to_python()
    //// This function should return a list of strings
    ////// Each value in the list should be the path to a file that will be downloaded by the browser

    pyodide.runPython(pythonCode);
}

async function main(){
    add_paragraph("Setting things up... This may take awhile if you haven't used this page before or if you've cleared your cookies...")
    pyodide = await loadPyodide();
    await setupPython(pyodide)
    add_paragraph('...Finished setting up!')

    add_file_upload_button()
}

function add_file_upload_button() {
    let input = document.createElement("input")
    input.type = 'file'
    input.multiple = true
    input.id='fileUploadButton'
    input.addEventListener('change',file_upload_listener)

    let element = document.getElementById("main");
    element.appendChild(input);
}

function file_upload_listener(event) {
    let saved_files = [];
    function save_file(event) {
        let file_name = '/'+event.srcElement.file_name_tmp;
        let binary_data = new Uint8Array(event.srcElement.result)
        pyodide.FS.writeFile(file_name, binary_data,
                            { encoding: "binary" })
        saved_files.push(file_name)
    }

    file_reader_promises = []
    for (let i = 0; i < event.srcElement.files.length; i++) {
        file_reader_promises.push(
            new Promise((resolve,reject) => {
                let fileReader = new FileReader();
                fileReader.file_name_tmp = event.srcElement.files[i].name
                fileReader.onload = (event) => resolve(save_file(event));
                fileReader.onerror = (err) => reject(err);
                fileReader.readAsArrayBuffer(event.srcElement.files[i]);
                file_reader_promises.push(fileReader)
            })
        );
    }

    let all_files_loaded = Promise.all(file_reader_promises)
    all_files_loaded.then(() => pass_files_to_python(saved_files))
}


function pass_files_to_python(file_path_array) {
    let js_entry_point = pyodide.globals.get('js_entry_point');
    let manipulated_files = js_entry_point(file_path_array).toJs()

    for (let i = 0; i < manipulated_files.length; i++) {
        let file_contents = pyodide.FS.readFile(manipulated_files[i],
                                                  {encoding: "binary" })
        let file_to_download = new File([file_contents],manipulated_files[i])
        download(file_to_download)
    }
}

var pyodide;
main()