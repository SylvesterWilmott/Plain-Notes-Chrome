'use strict'

/* global chrome */

import * as storage from './js/storage.js'
import * as menu from './js/menu.js'
import * as uid from './js/uid.js'
import * as message from './js/message.js'

chrome.runtime.onInstalled.addListener(init)
chrome.runtime.onStartup.addListener(loadPreferences)
chrome.contextMenus.onClicked.addListener(onMenuClick)
chrome.storage.onChanged.addListener(onStorageChanged)

async function init () {
  try {
    await setupContextMenu()
    await loadPreferences()
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function setupContextMenu () {
  const tabUrl = chrome.runtime.getURL('html/note.html')
  const popupUrl = chrome.runtime.getURL('html/popup.html')

  const menuItems = [
    {
      title: chrome.i18n.getMessage('OPTIONS_SPELLCHECK'),
      contexts: ['editable'],
      id: 'spellcheck',
      documentUrlPatterns: [`${tabUrl}*`],
      type: 'checkbox'
    },
    {
      title: chrome.i18n.getMessage('OPTIONS_AUTO_CLOSURE'),
      contexts: ['editable'],
      id: 'autoClosure',
      documentUrlPatterns: [`${tabUrl}*`],
      type: 'checkbox'
    },
    {
      title: chrome.i18n.getMessage('OPTIONS_AUTO_LIST'),
      contexts: ['editable'],
      id: 'autoList',
      documentUrlPatterns: [`${tabUrl}*`],
      type: 'checkbox'
    },
    {
      id: 's_1',
      contexts: ['editable'],
      documentUrlPatterns: [`${tabUrl}*`],
      type: 'separator'
    },
    {
      title: chrome.i18n.getMessage('NEW_NOTE_MENU'),
      contexts: ['selection'],
      id: 'newNote'
    },
    {
      title: chrome.i18n.getMessage('DELETE_NOTE'),
      contexts: ['page'],
      id: 'deleteNote',
      documentUrlPatterns: [`${popupUrl}*`]
    }
  ]

  try {
    await menu.create(menuItems)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function loadPreferences () {
  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  for (const preferenceName in storedPreferences) {
    const preferenceObj = storedPreferences[preferenceName]

    if (preferenceObj.type === 'checkbox') {
      try {
        await menu.update(preferenceName, preferenceObj.status)
      } catch (error) {
        console.error('An error occurred:', error)
      }
    }
  }
}

async function onMenuClick (info) {
  if (info.menuItemId === 'spellcheck' || info.menuItemId === 'autoClosure' || info.menuItemId === 'autoList') {
    try {
      await updateStoredPreferences(info)
    } catch (error) {
      console.error('An error occurred:', error)
    }
  } else if (info.menuItemId === 'newNote') {
    if (!info.selectionText) return
    let noteContent = info.selectionText
    if (info.pageUrl) noteContent += `\n\n\u2014 ${info.pageUrl}`

    try {
      await createNewNote(noteContent)
    } catch (error) {
      console.error('An error occurred:', error)
    }
  } else if (info.menuItemId === 'deleteNote') {
    try {
      await message.send({ msg: 'deleteNote' })
    } catch (error) {
      console.error('An error occurred:', error)
    }
  }
}

async function updateStoredPreferences (info) {
  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const preference = storedPreferences[info.menuItemId]

  if (!preference) return

  preference.status = info.checked

  try {
    await storage.save('preferences', storedPreferences)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function onStorageChanged (changes) {
  if (changes.preferences) {
    try {
      await loadPreferences()
    } catch (error) {
      console.error('An error occurred:', error)
    }
  }
}

async function createNewNote (noteContent) {
  const storedNotes = await storage.load('notes', []).catch((error) => {
    console.error('An error occurred:', error)
  })

  const text = noteContent
  const title = text.trim().split('\n')[0].substring(0, 75).trimEnd()
  const date = new Date().toString()
  const caretPos = noteContent.length
  const noteId = uid.create()

  const noteData = {
    id: noteId,
    title,
    modified: date,
    created: date,
    text,
    caret: caretPos
  }

  storedNotes.unshift(noteData)

  try {
    await storage.save('notes', storedNotes)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}
