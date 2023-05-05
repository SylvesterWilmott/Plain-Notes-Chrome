'use strict'

/* global confirm */

import * as storage from './storage.js'
import * as popup from './popup.js'

let navIndex = 0 // Current navigation index

export function init () {
  document.addEventListener('mouseover', onDocumentMouseover, false)
  document.addEventListener('keydown', onDocumentKeydown, false)
  document.addEventListener('mouseout', onDocumentMouseout, false)
}

function onDocumentMouseover (e) {
  const target = e.target

  if (target.classList.contains('nav-index')) {
    removeAllSelections()

    target.classList.add('selected')

    const navItems = document.querySelectorAll('.nav-index')
    navIndex = [...navItems].indexOf(target)
  }
}

function onDocumentKeydown (e) {
  const search = document.getElementById('search')

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (search === document.activeElement) {
      e.preventDefault()
      search.blur()
    }
    navigateDirection(e)
  } else if (e.key === 'Enter' && search !== document.activeElement) {
    clickSelectedItem()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    removeAllSelections()
    search.focus()
  } else if ((e.key === 'Backspace' || e.key === 'Delete') && (e.metaKey || e.ctrlKey)) {
    deleteSelectedItem()
  } else if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    const newNoteAction = document.getElementById('newNoteButton')
    newNoteAction.click()
  }
}

function onDocumentMouseout () {
  removeAllSelections()
}

function navigateDirection (e) {
  e.preventDefault()

  switch (e.key) {
    case 'ArrowDown':
      setNavIndex()
      navigateListDown()
      break
    case 'ArrowUp':
      setNavIndex()
      navigateListUp()
      break
  }

  // Scroll to the top or bottom of the page if necessary
  if (navIndex <= 1) scrollToTop()
  if (navIndex >= document.querySelectorAll('.nav-index').length - 1) {
    scrollToBottom()
  }

  const navItem = document.querySelectorAll('.nav-index')[navIndex]
  navItem.classList.add('selected')
  navItem.scrollIntoView({ block: 'nearest' })
}

function setNavIndex () {
  // Set the current navigation index to 0 if it's not already set
  if (!navIndex) {
    navIndex = 0
  }
}

function navigateListDown () {
  const navItems = document.querySelectorAll('.nav-index')
  if (navItems[navIndex].classList.contains('selected')) {
    // Remove the selection from the current item and highlight the next item
    navItems[navIndex].classList.remove('selected')
    const newIndex =
      navIndex !== navItems.length - 1 ? navIndex + 1 : navItems.length - 1
    navIndex = newIndex
  } else {
    // Set the current index to 0 if no items are selected
    navIndex = 0
  }
}

function navigateListUp () {
  const navItems = document.querySelectorAll('.nav-index')
  if (navItems[navIndex].classList.contains('selected')) {
    // Remove the selection from the current item and highlight the previous item
    navItems[navIndex].classList.remove('selected')
    const newIndex = navIndex !== 0 ? navIndex - 1 : 0
    navIndex = newIndex
  } else {
    // Set the current index to the last item if no items are selected
    navIndex = navItems.length - 1
  }
}

function clickSelectedItem () {
  const selectedItem = document.querySelectorAll('.nav-index')[navIndex]
  if (selectedItem) selectedItem.click()
}

async function deleteSelectedItem () {
  const selectedItem = document.querySelectorAll('.nav-index')[navIndex]
  const idOfSelected = selectedItem.dataset.id
  let storedNotes = await storage.load('notes', []).catch((error) => {
    console.error('An error occurred:', error)
  })

  if (!idOfSelected) return

  if (!confirm('Permanently delete this note?')) return

  storedNotes = storedNotes.filter((note) => note.id !== idOfSelected)

  try {
    await Promise.all([
      storage.save('notes', storedNotes),
      popup.renderList(storedNotes)
    ])
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

function removeAllSelections () {
  const navItems = document.querySelectorAll('.nav-index')
  for (const item of navItems) {
    item.classList.remove('selected')
  }

  navIndex = 0
}

function scrollToTop () {
  window.scrollTo(0, 0)
}

function scrollToBottom () {
  window.scrollTo(0, document.body.scrollHeight)
}
