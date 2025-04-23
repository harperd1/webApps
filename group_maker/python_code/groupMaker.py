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


if __name__ == "__main__":
    currentState = runGroupOptimizer('complexGroupsTest.csv', groupSize=4, maxAmountOfTime=10)
    groupResults = pd.read_csv('groupResults.csv')
    print(groupResults)
