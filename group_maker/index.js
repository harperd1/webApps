// Copy/paste your own python code here
// Your code must include a function called "js_entry point", follow the example shown here
// Warning, if your function includes an "if __name__=='main'" function or directly executes code,
//// pyiodide will try to execute that code instead of just defining a function for the browser to use
const pythonCode = `
import pandas as pd
import numpy as np
import itertools as it
import time

class Group:
    def __init__(self, groupName, members):
        '''
        groupName: str
        members: list of str
        '''
        self.name = groupName
        self.members = members

    def __str__(self):
        return f"Group: {self.name}, Members: {', '.join(self.members)}"
    
    def removeMemberByIndex(self, index):
        '''
        Removes a member from the group by index.
        index: int
        '''
        self.members.pop(index)
        
    def addMember(self, member):
        '''
        Adds a member to the group.
        member: str
        '''
        self.members.append(member)

class FormerGroups:
    def __init__(self):
        '''
        groups: list of Group objects
        '''
        self.groups = []

    def addGroup(self, groupName, members):
        '''
        Adds a group to the list of groups.
        groupName: str
        members: list of str
        '''
        group = Group(groupName, members)
        self.groups.append(group)

    def scoreCurrentGroupState(self, currentGroupState):
        """
        Scores the groups based on the number of members who were in the same group before.
        currentGroupState: list of Group objects
        """
        score = 0
        for group in currentGroupState:
            twoPersonCombos = it.combinations(group.members, 2)
            for twoPersonCombo in twoPersonCombos:
                for formerGroup in self.groups:
                    if twoPersonCombo[0] in formerGroup.members and twoPersonCombo[1] in formerGroup.members:
                        score += 1
        return score

def readFormerGroups(file_path):
    """
    Reads the former groups from a CSV file and returns a DataFrame.
    file_path: str
    """
    formerGroups = FormerGroups()
    def roundToNearest(x):
        """
        Rounds a number to the nearest integer.
        x: float
        """
        return int(round(x))

    df = pd.read_csv(file_path).set_index('Participant')
    for col in df.columns:
        if not col.lower().startswith('session'):
            raise Exception('Column names must start with "session"')
        
    for col in df.columns:
        sessionData = df[col]
        sessionData = df[col].dropna()
        sessionData = sessionData.apply(roundToNearest)

        for groupNumber in set(sessionData):
            groupData = sessionData[sessionData == groupNumber]
            groupName = f"{col}_{str(groupNumber)}"

            formerGroups.addGroup(groupName, groupData.index.tolist())
    
    participants = df.index.tolist()
    return participants,formerGroups

def scoreCurrentGroupState(currentGroupState, formerGroups):
    """
    Scores the groups based on the number of members who were in the same group before.
    currentGroupState: list of Group objects
    formerGroups: FormerGroups object
    """
    score = 0
    for group in currentGroupState:
        twoPersonCombos = it.combinations(group.members, 2)
        for twoPersonCombo in twoPersonCombos:
            for formerGroup in formerGroups.groups:
                if twoPersonCombo[0] in formerGroup.members and twoPersonCombo[1] in formerGroup.members:
                    score += 1
    return score
    
def swapMembers(group1, group2, index1, index2):
    '''
    Swaps members between two groups.
    group1: Group object
    group2: Group object
    index1: int (index of member in group1)
    index2: int (index of member in group2)
    '''
    group1MemberName = group1.members[index1]
    group2MemberName = group2.members[index2]
    group1.removeMemberByIndex(index1)
    group2.removeMemberByIndex(index2)
    group1.addMember(group2MemberName)
    group2.addMember(group1MemberName)

def runGroupOptimizer(formerGroupsInputFile,groupSize=4,maxAmountOfTime=10):
    """
    formerGroupsInputFile: str (path to the CSV file with former groups)
    groupSize: int (size of each group)
    maxAmountOfTime: int (maximum amount of time to run the optimizer in seconds)
    """

    participants,formerGroups = readFormerGroups(formerGroupsInputFile)

    leftOverPeople = len(participants)%groupSize
    if leftOverPeople == 0:
        blankSpotsNeeded = 0
    else:
        blankSpotsNeeded = groupSize - leftOverPeople
    for blankSpotIndex in range(blankSpotsNeeded):
        participants.append(f"Empty Spot {blankSpotIndex}")


    def generateRandomStartingState(participants, groupSize=groupSize):
        """
        Generates a random starting state for the groups.
        participants: list of str
        groupSize: int
        """
        np.random.shuffle(participants)
        groups = [participants[i:i + groupSize] for i in range(0, len(participants), groupSize)]
        return groups

    currentState = generateRandomStartingState(participants)
    currentState = [Group(f"Group_{i+1}", group) for i, group in enumerate(currentState)]
    if len(currentState) < 2:
        raise Exception("Only one group generated. Please check the number of participants.")

    def randomStep(currentState, formerGroups=formerGroups, currentStateScore=None):
        """
        Makes a random change to the groups
        currentState: list of Group objects
        formerGroups: FormerGroups object
        """
        group1Index = np.random.randint(0, len(currentState))
        group2Index = np.random.randint(0, len(currentState))
        while group1Index == group2Index:
            group2Index = np.random.randint(0, len(currentState))

        member1Index = np.random.randint(0, len(currentState[group1Index].members))
        member2Index = np.random.randint(0, len(currentState[group2Index].members))

        if currentStateScore is None:
            currentStateScore = formerGroups.scoreCurrentGroupState(currentState)
        swapMembers(currentState[group1Index], currentState[group2Index], member1Index, member2Index)

        newScore = formerGroups.scoreCurrentGroupState(currentState)

        if newScore > currentStateScore:
            #swap back
            swapMembers(currentState[group1Index], currentState[group2Index], -1, -1)
            newScore = currentStateScore

        return currentState, newScore

    startTime = time.time()
    integersReported = [-1]
    timePassed = 0
    while timePassed < maxAmountOfTime:
        currentState, currentStateScore = randomStep(currentState)
        if currentStateScore == 0:
            print("Perfect Grouping Found!")
            break
        timePassed = time.time() - startTime

        if int(timePassed) > integersReported[-1]:
            integersReported.append(int(timePassed))
            print(f"Time Passed: {round(timePassed)} seconds")
            print(f"Current Score: {currentStateScore}")
            print()

    results = []
    for group in currentState:
        results.append(group.members)
    results = pd.DataFrame(results,
                           index=[i.name for i in currentState],
                           columns=[f"Member_{i+1}" for i in range(len(currentState[0].members))])
    results.index.name = f'Number of Overlaps with Former Groups: {currentStateScore}'

    results.to_csv('groupResults.csv', index=True)
    return ['groupResults.csv']

def js_entry_point(input_file_path_list, groupSize, maxAmountOfTime):
    """
    Entry point for the JavaScript function.
    input_file_path: list with one element - the str (path to the CSV file with former groups)
    groupSize: int (size of each group)
    maxAmountOfTime: int (maximum amount of time to run the optimizer in seconds)
    """
    input_file_path_list = input_file_path_list.to_py()
    groupSize = int(groupSize)
    maxAmountOfTime = float(maxAmountOfTime)
    return runGroupOptimizer(input_file_path_list[0], groupSize, maxAmountOfTime)
`

function add_paragraph(text) {
    let para = document.createElement("p");
    para.innerHTML = text;
    para.className = "text-gray-900 dark:text-gray-400"
 
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

    await micropip.install('numpy')
    await micropip.install('pandas')
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
    console.log("Done with Setup!")
    console.log("-------------------------------------")
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
    // input.multiple = true
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

    let group_size = document.getElementById("groupSize").value
    let max_time = document.getElementById("maxAmountOfTime").value

    let manipulated_files = js_entry_point(file_path_array,group_size,max_time).toJs()

    for (let i = 0; i < manipulated_files.length; i++) {
        let file_contents = pyodide.FS.readFile(manipulated_files[i],
                                                  {encoding: "binary" })
        let file_to_download = new File([file_contents],manipulated_files[i])
        download(file_to_download)
    }
}

var pyodide;
main()