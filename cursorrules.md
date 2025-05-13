# Cursor Rules for Multi-Lang-Teacher

This document outlines the expected cursor behavior within the Multi-Lang-Teacher user interface to provide clear visual feedback and enhance user experience.

## 1. General Rules

* **Default:** The standard arrow cursor should be used for most static elements and general navigation.
* **Hover Effects:** When the user hovers over interactive elements, the cursor should change to indicate that the element is clickable or has a specific function.

## 2. Specific Element Cursor Rules

| Element Type                  | Cursor Style         | Description                                                                                                                                                              |
| ----------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Buttons (General)** | `pointer`              | Indicates that the element is clickable and will trigger an action.                                                                                                     |
| **Links (Text & Icons)** | `pointer`              | Indicates that clicking the element will navigate to another page or section.                                                                                             |
| **Text Input Fields** | `text`                 | Indicates that the user can click and type text within the field (e.g., for asking questions, submitting assignments).                                                     |
| **Dropdown Menus/Select Boxes** | `pointer`              | Indicates that clicking the element will reveal a list of options to choose from (e.g., language selection).                                                              |
| **Interactive Quiz Elements** | `pointer`              | For clickable options within quizzes (e.g., multiple-choice answers).                                                                                                  |
| **Scrollable Areas** | `grab` (on click/drag) | Indicates that the area can be scrolled horizontally or vertically by clicking and dragging. May revert to `default` when not actively dragging.                         |
| **Loading/Processing Indicators** | `wait` or `progress`   | Indicates that the application is currently processing a request and the user should wait.                                                                              |
| **Resizable Elements (Future)** | `ew-resize`, `ns-resize`, etc. | If the UI includes resizable elements (e.g., text areas), the appropriate resize cursor should appear when hovering over the resize handles.                       |
| **Disabled Elements** | `not-allowed`          | Indicates that the element is currently inactive and cannot be interacted with.                                                                                             |
| **Language Selection Controls** | `pointer`              | For buttons or icons that allow the user to switch between English, Japanese, and Simple Chinese for explanations or the UI language itself (if implemented).         |
| **Feedback Submission Buttons** | `pointer`              | For buttons that allow users to submit feedback on the agent's responses.                                                                                              |
| **Navigation Elements (Tabs, Sidebar)** | `pointer`              | For clickable items in navigation menus or sidebars that allow users to move between different sections of the application.                                         |
| **File Upload Controls** | `pointer`              | Indicates that clicking the element will open a file selection dialog (e.g., for submitting written assignments).                                                        |
| **Informational Icons (Hover)** | `help` or `pointer`    | Indicates that hovering over the icon will display a tooltip or further information. `pointer` if the icon itself triggers an action (e.g., opening a help section). |

## 3. Context-Specific Rules

* **During Code Display (if applicable):** The cursor should generally remain `text` to allow for selection and copying.
* **During Audio Playback (if applicable):** Standard media control cursors (`pointer` for buttons) should apply.
* **Error States:** The cursor should not change in a misleading way during error states, but visual cues within the UI should indicate the error.

## 4. Future Considerations

* **Custom Cursors:** Depending on the visual design of the application, custom cursors could be implemented for a more branded experience, but they should always clearly indicate interactivity.
* **Accessibility:** Ensure that cursor changes are not the only indicator of interactivity for users with visual impairments. Provide alternative visual cues as well.

This `cursorrules.md` document serves as a guideline for the expected cursor behavior within the Multi-Lang-Teacher application. Developers should adhere to these rules to create a consistent and intuitive user experience.
