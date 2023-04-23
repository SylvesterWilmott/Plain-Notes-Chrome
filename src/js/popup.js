'use strict'

/* global chrome */

import * as storage from './storage.js'
import * as navigation from './navigation.js'
import * as tabs from './tabs.js'
import * as i18n from './localize.js'
import * as uid from './uid.js'

document.addEventListener('DOMContentLoaded', init)

async function init () {
  try {
    await loadNotes()
  } catch (error) {
    console.error('An error occurred:', error)
  }

  navigation.init()
  registerListeners()
  i18n.localize()
  readyApp()
}

function readyApp () {
  const search = document.getElementById('search')
  search.placeholder = chrome.i18n.getMessage('SEARCHBAR_PLACEHOLDER')
  document.body.classList.remove('hidden')
}

async function loadNotes () {
  let storedNotes = await storage.load('notes', []).catch((error) => {
    console.error('An error occurred:', error)
  })

  if (!storedNotes.length) return

  storedNotes = storedNotes.filter(note => note.text.trim() !== '')

  try {
    await storage.save('notes', storedNotes)
  } catch (error) {
    console.error('An error occurred:', error)
  }

  try {
    await renderList(storedNotes)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

export async function renderList (arr) {
  const list = document.getElementById('notesList')

  const sortedList = await getSortedList(arr).catch((error) => {
    console.error('An error occurred:', error)
  })

  list.innerHTML = ''

  for (const { id, title } of sortedList) {
    const li = document.createElement('li')
    const div = document.createElement('div')

    li.setAttribute('data-id', id)
    li.classList.add('item', 'nav-index')

    div.innerText = title
    div.classList.add('title')

    li.appendChild(div)
    list.appendChild(li)
  }
}

function registerListeners () {
  const on = (id, event, handler) => document.getElementById(id).addEventListener(event, handler, false)

  on('newNoteButton', 'click', onNewNoteButtonClicked)
  on('notesList', 'click', onNewNotesListClicked)
  on('search', 'input', onSearchInput)
}

async function onNewNoteButtonClicked () {
  const id = uid.create()

  try {
    await openTabWithNoteId(id)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function onNewNotesListClicked (e) {
  const targetElement = e.target

  if (!('id' in targetElement.dataset)) return

  const noteId = targetElement.dataset.id

  try {
    await openTabWithNoteId(noteId)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function openTabWithNoteId (id) {
  try {
    await tabs.create(`../html/note.html?id=${id}`)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function onSearchInput () {
  const searchQuery = this.value

  const storedNotes = await storage.load('notes', []).catch((error) => {
    console.error('An error occurred:', error)
  })

  const filtered = storedNotes.filter(
    (item) =>
      item.text.toLowerCase().indexOf(searchQuery.toLowerCase()) > -1
  )

  try {
    await renderList(filtered)
    navigation.init()
    window.scrollTo(0, 0)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function getSortedList (arr) {
  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  let sorted

  switch (storedPreferences.sorting.status) {
    case 'title':
      sorted = arr.sort((a, b) => {
        const textA = a.title.toUpperCase()
        const textB = b.title.toUpperCase()
        return textA < textB ? -1 : textA > textB ? 1 : 0
      })
      break
    case 'modified':
      sorted = arr.sort((a, b) => {
        return new Date(b.modified) - new Date(a.modified)
      })
      break
    case 'created':
      sorted = arr.sort((a, b) => {
        return new Date(b.created) - new Date(a.created)
      })
      break
  }

  return sorted
}
