"use strict";

/* global chrome */

import * as storage from "./storage.js";
import * as prediction from "./prediction.js";
import * as regex from "./regex.js";
import * as message from "./message.js";

let noteId; // global reference to current note id
let storedPreferences; // Global reference to users preferences
let predictiveModel = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  noteId = getNoteIdFromUrl();

  try {
    await Promise.all([loadNote(), loadPreferences()]);
  } catch (error) {
    console.error("An error occurred:", error);
  }

  autoSizeEditor();
  registerListeners();
  populatePredictiveModel();

  document.body.classList.remove("hidden");
}

async function loadPreferences() {
  storedPreferences = await storage
    .load("preferences", storage.preferenceDefaults)
    .catch((error) => {
      console.error("An error occurred:", error);
    });

  const editor = document.getElementById("editor");

  // Update spellcheck status
  if (storedPreferences.spellcheck.status) {
    editor.spellcheck = true;
  }
}

function registerListeners() {
  const on = (target, event, handler) =>
    (typeof target === "string" ? document.getElementById(target) : target).addEventListener(event, handler, false);

  on("editor", "input", onEditorInput);
  on("editor", "keydown", onEditorKeydown);
  on("editor", "contextmenu", onEditorContextMenu);
  on(window, "resize", throttledOnWindowResize);

  chrome.storage.onChanged.addListener(onStorageChanged);
}


async function loadNote() {
  if (!noteId) return;

  const storedNotes = await storage.load("notes", []).catch((error) => {
    console.error("An error occurred:", error);
  });

  const noteData = storedNotes.find((note) => note.id === noteId);

  const editor = document.getElementById("editor");

  if (noteData) {
    editor.value = noteData.text;
    editor.selectionEnd = noteData.caret;
    document.title = noteData.title;
  } else {
    document.title = chrome.i18n.getMessage("UNTITLED_NOTE");
  }

  editor.focus();
}

function getNoteIdFromUrl() {
  const url = window.location.search;
  const params = new URLSearchParams(url);
  const id = params.get("id");

  if (id && id !== "undefined") {
    return id;
  }
}

function onEditorInput(e) {
  autoSizeEditor();
  handleAutocomplete(e);
  debounceOnEditorInput(e);
  populatePredictiveModel();
}

function autoSizeEditor() {
  const editor = document.getElementById("editor");
  const previousScrollPosition = document.documentElement.scrollTop;

  editor.style.height = "auto";

  editor.style.height = editor.scrollHeight + "px";

  // if the caret is at the end of the textarea, scroll to the bottom
  if (editor.selectionStart === editor.value.length) {
    window.scrollTo(0, document.body.scrollHeight);
  } else {
    // Otherwise restore the previous scroll position
    window.scrollTo(0, previousScrollPosition);
  }
}

const populatePredictiveModel = debounce(async function (e) {
  const editor = document.getElementById("editor");
  const text = editor.value;

  try {
    predictiveModel = await message.send({ msg: 'predictive', text: text })
  } catch (error) {
    console.error('An error occurred:', error)
  }
}, 500);

const debounceOnEditorInput = debounce(async function (e) {
  const storedNotes = await storage.load("notes", []).catch((error) => {
    console.error("An error occurred:", error);
  });

  const foundNoteIndex = storedNotes.findIndex((note) => note.id === noteId);

  const text = e.target.value;
  const title = text.trim().split("\n")[0].substring(0, 75).trimEnd();
  const date = new Date().toString();
  const caretPos = e.target.selectionEnd;

  let noteData;

  if (foundNoteIndex !== -1) {
    noteData = storedNotes[foundNoteIndex];
    noteData.modified = date;
    noteData.text = text;
    noteData.caret = caretPos;

    if (title !== noteData.title) {
      noteData.title = title;
      document.title = text.length
        ? title
        : chrome.i18n.getMessage("UNTITLED_NOTE");
    }
  } else {
    noteData = {
      id: noteId,
      title,
      modified: date,
      created: date,
      text,
      caret: caretPos,
    };
    storedNotes.unshift(noteData);
    document.title = text.length
      ? title
      : chrome.i18n.getMessage("UNTITLED_NOTE");
  }

  try {
    await storage.save("notes", storedNotes);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}, 500);

function debounce(func, delay) {
  let timerId;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timerId);
    timerId = setTimeout(() => func.apply(context, args), delay);
  };
}

async function onStorageChanged(changes) {
  const editor = document.getElementById("editor");

  if (changes.notes && !document.hasFocus()) {
    const { newValue, oldValue } = changes.notes;
    const note = newValue?.find((n) => n.id === noteId);

    if (note && (!oldValue || oldValue.text !== note.text)) {
      editor.value = note.text;
      editor.selectionEnd = note.caret;
      document.title = note.title;
    }
  }

  if (changes.preferences) {
    loadPreferences();

    // const { newValue, oldValue } = changes.preferences
    // const spellcheck = newValue?.spellcheck.status

    // if (typeof spellcheck === 'boolean' && (!oldValue || oldValue.spellcheck.status !== newValue.spellcheck.status)) {
    //  editor.spellcheck = newValue.spellcheck.status
    // }
  }
}

function onEditorKeydown(e) {
  const key = e.key;

  const keyHandlers = {
    Tab: handleTab,
  };

  const autoClosureHandlers = {
    "(": handleAutoClosure,
    "{": handleAutoClosure,
    "[": handleAutoClosure,
    "'": handleAutoClosure,
    '"': handleAutoClosure,
    "`": handleAutoClosure,
    ")": handleAutoClosure,
    "}": handleAutoClosure,
    "]": handleAutoClosure,
  };

  const autoListHandlers = {
    Enter: handleEnter,
  };

  if (storedPreferences.autoClosure.status) {
    Object.assign(keyHandlers, autoClosureHandlers);
  }

  if (storedPreferences.autoList.status) {
    Object.assign(keyHandlers, autoListHandlers);
  }

  const handler = keyHandlers[key];

  if (handler) {
    handler(e);
  }
}

function insertNode(...nodes) {
  for (const node of nodes) {
    document.execCommand("insertText", false, node);
  }
}

function deleteNode(times) {
  for (let i = 0; i < times; i++) {
    document.execCommand("delete");
  }
}

function handleTab(e) {
  e.preventDefault();

  const predictionEl = document.getElementById("prediction");
  const predictedWord = predictionEl.innerText;

  if (predictedWord && predictedWord.length) {
    insertNode(predictedWord);
  } else if (e.shiftKey) {
    const editor = e.target;
    const start = editor.selectionStart;
    if (start > 0 && editor.value.charAt(start - 1) === "\t") {
      deleteNode(1);
    }
  } else {
    insertNode("\t");
  }
}

function handleEnter(e) {
  const line = getCurrentLine();

  let match;
  let type;

  if (line) {
    if (line.match(regex.CL_REGEX)) {
      match = [...line.matchAll(regex.CL_REGEX)][0];
      type = "cl";
    } else if (line.match(regex.UL_REGEX)) {
      match = [...line.matchAll(regex.UL_REGEX)][0];
      type = "ul";
    } else if (line.match(regex.OL_REGEX)) {
      match = [...line.matchAll(regex.OL_REGEX)][0];
      type = "ol";
    }
  }

  if (!match) {
    return;
  } else {
    e.preventDefault();
  }

  const prefix = match[1];
  let c = match[2];
  const content = match[3];

  if (type && type === "cl") {
    c = c.replace(/x/, " ");
  }

  if (content) {
    if (type === "ol") {
      insertNode(
        "\n",
        c.replace(/[0-9]+/, (parseInt(c) + 1).toString()) + "." + " "
      );
    } else {
      insertNode("\n", c + " ");
    }
  } else {
    deleteNode(prefix.length);
  }
}

function getCurrentLine() {
  const editor = document.getElementById("editor");

  return editor.value.slice(
    editor.value.lastIndexOf("\n", editor.selectionStart - 1) + 1,
    ((end = editor.value.indexOf("\n", editor.selectionStart)) =>
      end > -1 ? end : undefined)()
  );
}

function getCurrentWord() {
  const editor = document.getElementById("editor");

  let start = editor.selectionStart - 1;
  let end = editor.selectionEnd;

  while (
    !editor.value.charAt(start).match(regex.WHITESPACE_REGEX) &&
    start >= 0
  ) {
    start--;
  }

  while (
    !editor.value.charAt(end).match(regex.WHITESPACE_REGEX) &&
    end < editor.value.length
  ) {
    end++;
  }

  const word = editor.value.substring(start, end).trim();

  return {
    start,
    end,
    word,
  };
}

function handleAutoClosure(e) {
  const editor = document.getElementById("editor");

  const OPEN_CLOSE_PAIRS = [
    { open: "(", close: ")", type: "bracket" },
    { open: "{", close: "}", type: "bracket" },
    { open: "[", close: "]", type: "bracket" },
    { open: "[", close: "]", type: "bracket" },
    { open: "«", close: "»", type: "bracket" },
    { open: "‹", close: "›", type: "bracket" },
    { open: "'", close: "'", type: "quote" },
    { open: "`", close: "`", type: "quote" },
    { open: '"', close: '"', type: "quote" },
  ];

  const foundOpen = OPEN_CLOSE_PAIRS.find((x) => x.open === e.key);
  const foundClose = OPEN_CLOSE_PAIRS.find((x) => x.close === e.key);
  const selection = window.getSelection().toString();
  const nextChar = editor.value.charAt(editor.selectionEnd);

  if (foundOpen) {
    const word = getCurrentWord().word;

    if (
      word &&
      word.match(regex.WORD_REGEX) &&
      foundOpen.type === "quote" &&
      nextChar !== foundOpen.close &&
      !selection
    ) {
      return;
    }

    e.preventDefault();

    if (selection) {
      insertNode(foundOpen.open, selection, foundOpen.close);
      moveCaret(-1);
    } else if (foundClose && nextChar === foundOpen.close) {
      moveCaret(1);
    } else {
      insertNode(foundOpen.open, foundOpen.close);
      moveCaret(-1);
    }
  } else if (foundClose) {
    const line = getCurrentLine();
    const regex = new RegExp("\\" + foundClose.open, "g");

    if (line.match(regex) && nextChar === foundClose.close) {
      e.preventDefault();
      moveCaret(1);
    }
  }
}

function moveCaret(n) {
  const editor = document.getElementById("editor");

  if (n < 0) {
    editor.selectionEnd = editor.selectionEnd + n;
  } else {
    editor.selectionStart = editor.selectionEnd + n;
  }
}

function onEditorContextMenu() {
  const wordObj = getCurrentWord();
  const selection = window.getSelection().toString();

  if (!selection && isValidUrl(wordObj.word)) {
    makeSelection(wordObj.start, wordObj.end);
  }
}

function isValidUrl(str) {
  let url;

  try {
    url = new URL(str);
  } catch {
    url = null;
  }

  return Boolean(url);
}

function makeSelection(start, end) {
  const editor = document.getElementById("editor");

  editor.selectionStart = start + 1;
  editor.selectionEnd = end;
}

function handleAutocomplete(e) {
  const word = getCurrentWord();
  const predictionEl = document.getElementById("prediction");
  const isEndOfLine = isCaretAtEndOfLine();

  predictionEl.innerText = "";

  if (
    storedPreferences.predictive.status === false ||
    !isEndOfLine ||
    !predictiveModel ||
    Object.keys(predictiveModel).length === 0
  )
    return;

  const allPredictions = prediction.predict(word.word, predictiveModel);

  if (!allPredictions || allPredictions.length === 0) {
    return;
  } else {
    predictionEl.innerText = ` ${allPredictions[0].word}`;
    positionElementNextToCaret(predictionEl)
  }
}

function positionElementNextToCaret(el) {
  const editor = document.getElementById('editor')
  const position = getCaretPosition(editor);
  el.style.top = `${position.x - 8}px`;
  el.style.left = `${position.y}px`;
}

function getCaretPosition(el) {
  const div = document.createElement("div");
  const span = document.createElement("span");
  const editorStyles = getComputedStyle(el);

  for (const s of editorStyles) {
    div.style[s] = editorStyles[s];
  }

  div.innerText = el.value.substring(0, el.selectionEnd);

  div.appendChild(span);

  document.body.appendChild(div);

  let x = span.offsetTop - editor.offsetHeight;
  let y = span.offsetLeft;

  document.body.removeChild(div);

  return { x: x, y: y };
}

function isCaretAtEndOfLine() {
  const editor = document.getElementById("editor");
  const selectionStart = editor.selectionStart;

  const lineStart = editor.value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd =
    editor.value.indexOf("\n", selectionStart) !== -1
      ? editor.value.indexOf("\n", selectionStart)
      : editor.value.length;
  const lineText = editor.value.substring(lineStart, lineEnd);

  return lineStart + lineText.length === selectionStart;
}


const throttledOnWindowResize = throttle(onWindowResize, 100)

function onWindowResize() {
  const predictionEl = document.getElementById("prediction");
  const predictionText = predictionEl.innerText;

  if (predictionText && predictionText.length) {
    positionElementNextToCaret(predictionEl)
  }
}

function throttle (func, delay) {
  let lastExecTime = 0
  return function () {
    const context = this
    const args = arguments
    const now = Date.now()
    if (now - lastExecTime >= delay) {
      lastExecTime = now
      func.apply(context, args)
    }
  }
}