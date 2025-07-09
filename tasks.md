# Tasks
We are building a chrome extension that adds a toolbar to a online document editor called GraFx Studio. The extension is built using React and TypeScript. The code is in src/ and is built using bun (https://bun.sh/). The entry point is src/index.tsx. The toolbar is defined in src/components/Toolbar.tsx. The toolbar uses mantine (https://mantine.dev/) for the UI.

We are going to change the OutTemplateModal.tsx to support multiple outputs of the template.

Your tasks are as follows:

## Task 1

Make the modal bigger, taking up 75% of the space, and get rid of the modal title.

## Task 2

We will have the modal will be split up into two sections a right section "Output Settings" and a left section "Output Tasks"

## Task 3 - Output Settings
The "Output Settings" should have a header that reads "Output Settings" with a paragraph underneath. Pick your output settings to output the template.

Under the paragraph should show a list of available outputs that are now multiselect, these outputs are remembered from local storage, or if missing then nothing is selected. 

Under that should be Selected Layouts with a multiselect of all available layouts in the template, which can be getting by getAllLayouts from src/studio/layoutHandler.ts and filtering on available layouts.

The current selected layout can be gotten by getSelected from src/studio/frameHandler.ts and should be selected by default.

The display should be the layout name, but the value we will use is the layout id.

Underneath that there should be a three grey buttons "Attach Variable Sheet (JSON, CVS)" and "Download Variable JSON" and "Download Variable CSV".

Then under that is the blue "Create Output" button that is enabled when at least one output and one layout is selected.


## Task 4 - Attach Variable Sheet

Attach variable sheet will take a JSON which will be applied to the output task in the body it will add a variables key which will contain the JSON uploaded.

If the user uploads a CSV we need to convert to a JSON using json-2-csv

## Task 5 - Download Variable JSON

This will call get all the varaibles in the template and download a JSON with an array with variables names and current values:

[
    {
        "variableName": "value"
    }
]

The variables can be gotten with getAllVariables from src/studio/variableHandler.ts

You will need to take account of ListVariable, which has the value on selected

## Task 6 - Download Variable CSV

Do the same as in Task 7, but convert to a CSV where the headers of each column are the variable names and the rows are the values.
Use json-2-csv ton convert to CSV to then download

## Task 7 - Create Output

When this button is pressed, the right section should show a loading spinner and a message "Creating Output". 

For each output setting selected and each layout we should create a new task replacing output settings ID with the selected and the layouts to export with the selected layout id.

(At this time, even though layouts to export is an array, you can only do one layout at a time).

Each task should be added to a slot on the left side "Output Tasks".

## Task 8 - Output Tasks

Each task added will have the output settings type and the layout name in a card on the left side with a button that is a loading spinner.

When a task is completed and successful, that button turns into a download icon button, where they can download the task.

If a task fails, the button turns into a red error icon where they can download a error report.

If there is one error, a button at the bottom of all the tasks will be ungreyed that says "Download All Error Reports" which will download a zip file with all the error reports using jszip. Next to that button is "Download Document State" which downloads the document JS.

When all tasks are complete, the right side should show a message "All tasks completed" with a button to close the modal.