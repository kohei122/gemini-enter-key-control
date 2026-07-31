# Gemini Enter Key Control (by marusin)

A Chrome extension that controls Enter key behavior in Gemini, Gemini Notebook, formerly NotebookLM, Google Flow, Google Chat on the web, and Google Chat inside Gmail.

## Features

- Press Enter to insert a newline  
- Press Shift + Enter to send your message  
- Supports Ctrl, Cmd, and combined send key modes
- Supports Gemini Notebook on both `notebook.google.com` and the legacy `notebooklm.google.com` domain
- Supports the Google Chat web app and Google Chat inside Gmail

## Google Chat

- Plain Enter inserts a newline, and the selected send shortcut sends the message.
- Settings are shared with Gemini, Gemini Notebook, and Google Flow.
- Supports regular direct messages, group direct messages, and standard space composers that use the supported composer structure.
- Supports Google Chat loaded inside Gmail through its `chat.google.com` frame.
- Gmail email composition, reply, search, subject, and forwarding fields remain outside the extension's scope.
- Google Meet chat is currently not supported.
- Detects the editor and send controls from stable DOM attributes rather than translated UI labels.
- Advanced message editing and rich-text-specific behavior are not separately guaranteed.

## Benefits

- Write longer prompts without accidental sending  
- Improve typing comfort and control  
- Reduce mistakes when editing messages  

## Privacy

- No data collection  
- No external communication  
- Works only on supported Gemini, Gemini Notebook, Google Flow, and Google Chat pages and frames

## Installation

1. Download from Chrome Web Store  
2. Enable the extension  
3. Start using Gemini with improved input behavior  

## Changelog

### 1.6.1
- Added support for Google Chat inside Gmail.
- Kept Gmail email composition, reply, search, subject, and forwarding fields outside the extension's scope.
- Improved frame-specific Google Chat detection.
- Improved compatibility and stability.

### 1.6.0
- Added support for the Google Chat web app at `chat.google.com`.
- Plain Enter inserts a newline, and the selected shortcut sends the message.
- Supports regular direct messages, group direct messages, and standard space composers.
- Added safeguards for IME input, suggestion UI, and repeated key events.
- Uses language-independent composer and send-button attributes to improve multilingual compatibility.
- Google Chat in Gmail is not included.

### 1.5.1
- Added support for the new Gemini Notebook domain, `notebook.google.com`.
- Kept compatibility with the legacy `notebooklm.google.com` domain during the transition.

### 1.5.0
- Added Google Flow support.
- On Windows, Google Flow supports Shift+Enter, Ctrl+Enter, both-key mode, and Shift+Ctrl+Enter sending modes.
- Plain Enter inserts a newline, and focus returns to the prompt editor after sending.
- Send shortcuts are blocked during generation so they do not activate the stop button.
- Command+Enter and Shift+Command+Enter are currently unsupported in Google Flow on macOS. This limitation does not affect the existing Mac shortcuts on Gemini.
- Detects Google Flow inputs and generation buttons from nearby DOM structure without depending on UI language labels.

### 1.4.1
- Updated NotebookLM references to Gemini Notebook, formerly NotebookLM.
- Updated app descriptions, README, and multilingual UI text.

### 1.4.0
- Improved Gemini send button detection based on the input/composer DOM structure.
- Added language-independent signals to improve compatibility across multilingual Gemini UI environments.
- Reduced the risk of incorrectly detecting upload, microphone, mode selector, sidebar, menu, feedback, or other unrelated buttons.
- Removed broad document-level button search for Gemini send button detection.

### 1.3.1
- Improved send shortcut compatibility for Gemini in many non-Japanese UI languages.
- Improved send button detection for multilingual Gemini UI labels.
- Adjusted send button detection to avoid feedback, comment, and report buttons.

### 1.3.0
- Improved IME handling for Japanese, Chinese, Korean, and other composition-based input methods.
- Fixed duplicate content script initialization to prevent repeated newline handling.
- Added a clearer note that the browser's built-in Gemini side panel is not supported.

### 1.2.2
- Added Spanish localization
- Added Brazilian Portuguese localization
- Added Traditional Chinese localization

### 1.2.1
- Added Cmd+Enter support for Mac users
- Added Shift+Cmd+Enter send mode
- Added Mac-only Cmd support to the existing Shift/Ctrl send modes
- Shows Cmd send key options only on macOS
- Fixed Gemini send button detection when the sidebar is open

### 1.2.0
- Added support for the Gemini Notebook, formerly NotebookLM, chat input
- Improved Enter key handling for Gemini Notebook, formerly NotebookLM
- Kept Gemini Notebook, formerly NotebookLM, source search fields outside the extension's control

### 1.1.5
- Updated popup description text
- Updated localized app descriptions

### 1.1.4
- Added collapsible secondary settings in popup
- Moved language/version/other extensions link into secondary area

### 1.1.3
- UI improvements

### 1.1.1
- Current release

## Developer

Developed by Marushin

## Note

- This extension depends on Gemini's internal UI/event behavior, so future Gemini UI changes may affect functionality.
