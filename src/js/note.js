'use strict'

/* global chrome */

import * as storage from './storage.js'
import * as regex from './regex.js'

let noteId // global reference to current note id
let storedPreferences // Global reference to users preferences

document.addEventListener('DOMContentLoaded', init)

async function init () {
  noteId = getNoteIdFromUrl()

  try {
    await Promise.all([loadNote(), loadPreferences()])
  } catch (error) {
    console.error('An error occurred:', error)
  }

  registerListeners()

  document.body.classList.remove('hidden')
}

async function loadPreferences () {
  storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const editor = document.getElementById('editor')

  // Update spellcheck status
  editor.spellcheck = storedPreferences.spellcheck.status
}

function registerListeners () {
  const on = (id, event, handler) => document.getElementById(id).addEventListener(event, handler, false)

  on('editor', 'input', onEditorInput)
  on('editor', 'keydown', onEditorKeydown)
  on('editor', 'contextmenu', onEditorContextMenu)

  chrome.storage.onChanged.addListener(onStorageChanged)
}

async function loadNote () {
  if (!noteId) return

  const storedNotes = await storage.load('notes', []).catch((error) => {
    console.error('An error occurred:', error)
  })

  const noteData = storedNotes.find((note) => note.id === noteId)

  const editor = document.getElementById('editor')

  if (noteData) {
    editor.value = noteData.text
    editor.selectionEnd = noteData.caret
    document.title = noteData.title
  } else {
    document.title = chrome.i18n.getMessage('UNTITLED_NOTE')
  }

  editor.focus()
}

function getNoteIdFromUrl () {
  const url = window.location.search
  const params = new URLSearchParams(url)
  const id = params.get('id')

  if (id && id !== 'undefined') {
    return id
  }
}

const onEditorInput = debounce(async function () {
  const storedNotes = await storage.load('notes', []).catch((error) => {
    console.error('An error occurred:', error)
  })

  const foundNoteIndex = storedNotes.findIndex((note) => note.id === noteId)

  const text = this.value
  const title = text.trim().split('\n')[0].substring(0, 75).trimEnd()
  const date = new Date().toString()
  const caretPos = this.selectionEnd

  let noteData

  if (foundNoteIndex !== -1) {
    noteData = storedNotes[foundNoteIndex]
    noteData.modified = date
    noteData.text = text
    noteData.caret = caretPos

    if (title !== noteData.title) {
      noteData.title = title
      document.title = text.length ? title : chrome.i18n.getMessage('UNTITLED_NOTE')
    }
  } else {
    noteData = {
      id: noteId,
      title,
      modified: date,
      created: date,
      text,
      caret: caretPos
    }
    storedNotes.unshift(noteData)
    document.title = text.length ? title : chrome.i18n.getMessage('UNTITLED_NOTE')
  }

  try {
    await storage.save('notes', storedNotes)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}, 500)

function debounce (func, delay) {
  let timerId
  return async function () {
    const context = this
    const args = arguments
    clearTimeout(timerId)
    return new Promise((resolve) => {
      timerId = setTimeout(() => {
        resolve(func.apply(context, args))
      }, delay)
    })
  }
}

async function onStorageChanged (changes) {
  const editor = document.getElementById('editor')

  if (changes.notes && !document.hasFocus()) {
    const { newValue, oldValue } = changes.notes
    const noteOldValue = oldValue?.find((n) => n.id === noteId)
    const noteNewValue = newValue?.find((n) => n.id === noteId)

    if (noteNewValue && (!noteOldValue || noteOldValue.text !== noteNewValue.text)) {
      editor.value = noteNewValue.text
      editor.selectionEnd = noteNewValue.caret
      document.title = noteNewValue.title
    }
  }

  if (changes.preferences) {
    loadPreferences()
  }
}

function onEditorKeydown (e) {
  const key = e.key

  const keyHandlers = {
    Tab: handleTab
  }

  const autoClosureHandlers = {
    '(': handleAutoClosure,
    '{': handleAutoClosure,
    '[': handleAutoClosure,
    "'": handleAutoClosure,
    '"': handleAutoClosure,
    '`': handleAutoClosure,
    ')': handleAutoClosure,
    '}': handleAutoClosure,
    ']': handleAutoClosure
  }

  const autoListHandlers = {
    Enter: handleEnter
  }

  if (storedPreferences.autoClosure.status) {
    Object.assign(keyHandlers, autoClosureHandlers)
  }

  if (storedPreferences.autoList.status) {
    Object.assign(keyHandlers, autoListHandlers)
  }

  const handler = keyHandlers[key]

  if (handler) {
    handler(e)
  }
}

function insertNode (...nodes) {
  for (const node of nodes) {
    document.execCommand('insertText', false, node)
  }
}

function deleteNode (times) {
  for (let i = 0; i < times; i++) {
    document.execCommand('delete')
  }
}

function handleTab (e) {
  e.preventDefault()

  if (e.shiftKey) {
    const editor = e.target
    const start = editor.selectionStart
    if (start > 0 && editor.value.charAt(start - 1) === '\t') {
      deleteNode(1)
    }
  } else {
    insertNode('\t')
  }
}

function handleEnter (e) {
  const line = getCurrentLine()

  let match
  let type

  if (line) {
    if (line.match(regex.CL_REGEX)) {
      match = [...line.matchAll(regex.CL_REGEX)][0]
      type = 'cl'
    } else if (line.match(regex.UL_REGEX)) {
      match = [...line.matchAll(regex.UL_REGEX)][0]
      type = 'ul'
    } else if (line.match(regex.OL_REGEX)) {
      match = [...line.matchAll(regex.OL_REGEX)][0]
      type = 'ol'
    }
  }

  if (!match) {
    return
  } else {
    e.preventDefault()
  }

  const prefix = match[1]
  let c = match[2]
  const content = match[3]

  if (type && type === 'cl') {
    c = c.replace(/x/, ' ')
  }

  if (content) {
    if (type === 'ol') {
      insertNode(
        '\n',
        c.replace(/[0-9]+/, (parseInt(c) + 1).toString()) + '.' + ' '
      )
    } else {
      insertNode('\n', c + ' ')
    }
  } else {
    deleteNode(prefix.length)
  }
}

function getCurrentLine () {
  const editor = document.getElementById('editor')

  return editor.value.slice(
    editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1,
    ((end = editor.value.indexOf('\n', editor.selectionStart)) =>
      end > -1 ? end : undefined)()
  )
}

function getCurrentWord () {
  const editor = document.getElementById('editor')

  let start = editor.selectionStart - 1
  let end = editor.selectionEnd

  while (
    !editor.value.charAt(start).match(regex.WHITESPACE_REGEX) &&
    start >= 0
  ) {
    start--
  }

  while (
    !editor.value.charAt(end).match(regex.WHITESPACE_REGEX) &&
    end < editor.value.length
  ) {
    end++
  }

  const word = editor.value.substring(start, end).trim()

  return {
    start,
    end,
    word
  }
}

function handleAutoClosure (e) {
  const editor = document.getElementById('editor')

  const OPEN_CLOSE_PAIRS = [
    { open: '(', close: ')', type: 'bracket' },
    { open: '{', close: '}', type: 'bracket' },
    { open: '[', close: ']', type: 'bracket' },
    { open: '[', close: ']', type: 'bracket' },
    { open: '«', close: '»', type: 'bracket' },
    { open: '‹', close: '›', type: 'bracket' },
    { open: "'", close: "'", type: 'quote' },
    { open: '`', close: '`', type: 'quote' },
    { open: '"', close: '"', type: 'quote' }
  ]

  const foundOpen = OPEN_CLOSE_PAIRS.find((x) => x.open === e.key)
  const foundClose = OPEN_CLOSE_PAIRS.find((x) => x.close === e.key)
  const selection = window.getSelection().toString()
  const nextChar = editor.value.charAt(editor.selectionEnd)

  if (foundOpen) {
    const word = getCurrentWord().word

    if (
      word &&
      word.match(regex.WORD_REGEX) &&
      foundOpen.type === 'quote' &&
      nextChar !== foundOpen.close &&
      !selection
    ) {
      return
    }

    e.preventDefault()

    if (selection) {
      insertNode(foundOpen.open, selection, foundOpen.close)
      moveCaret(-1)
    } else if (foundClose && nextChar === foundOpen.close) {
      moveCaret(1)
    } else {
      insertNode(foundOpen.open, foundOpen.close)
      moveCaret(-1)
    }
  } else if (foundClose) {
    const line = getCurrentLine()
    const regex = new RegExp('\\' + foundClose.open, 'g')

    if (line.match(regex) && nextChar === foundClose.close) {
      e.preventDefault()
      moveCaret(1)
    }
  }
}

function moveCaret (n) {
  const editor = document.getElementById('editor')

  if (n < 0) {
    editor.selectionEnd = editor.selectionEnd + n
  } else {
    editor.selectionStart = editor.selectionEnd + n
  }
}

function onEditorContextMenu () {
  const wordObj = getCurrentWord()
  const selection = window.getSelection().toString()

  if (!selection && isValidUrl(wordObj.word)) {
    makeSelection(wordObj.start, wordObj.end)
  }
}

function isValidUrl (str) {
  let url

  try {
    url = new URL(str)
  } catch {
    url = null
  }

  return Boolean(url)
}

function makeSelection (start, end) {
  const editor = document.getElementById('editor')

  editor.selectionStart = start + 1
  editor.selectionEnd = end
}
