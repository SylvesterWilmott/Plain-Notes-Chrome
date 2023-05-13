'use strict'

/* global chrome */

import * as storage from './storage.js'
import * as i18n from './localize.js'
import * as tabs from './tabs.js'

document.addEventListener('DOMContentLoaded', init)

async function init () {
  try {
    await loadPreferences()
  } catch (error) {
    console.error('An error occurred:', error)
  }

  registerListeners()
  i18n.localize()
  setupDocument()
}

function setupDocument () {
  const animatedElements = document.querySelectorAll('.no-transition')

  for (const el of animatedElements) {
    const pseudoBefore = window.getComputedStyle(el, ':before').content
    const pseudoAfter = window.getComputedStyle(el, ':after').content
    const hasBeforeContent = pseudoBefore !== 'none' && pseudoBefore !== ''
    const hasAfterContent = pseudoAfter !== 'none' && pseudoAfter !== ''

    if (hasBeforeContent || hasAfterContent) {
      el.addEventListener(
        'transitionend',
        function () {
          el.classList.remove('no-transition')
        },
        { once: true }
      )
    }

    el.classList.remove('no-transition')
  }

  const versionElement = document.getElementById('version')
  const version = `v${chrome.runtime.getManifest().version}`
  versionElement.innerText = version

  document.body.classList.remove('hidden')
}

function registerListeners () {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]')

  for (const checkbox of checkboxes) {
    checkbox.addEventListener('change', onCheckBoxChanged)
  }

  const selects = document.querySelectorAll('select')

  for (const select of selects) {
    select.addEventListener('change', onSelectChanged)
  }

  const buttons = document.querySelectorAll('button')

  for (const button of buttons) {
    button.addEventListener('click', onButtonClicked)
  }

  chrome.storage.onChanged.addListener(onStorageChanged)
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

async function loadPreferences () {
  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  for (const preferenceName in storedPreferences) {
    const preferenceObj = storedPreferences[preferenceName]
    const preferenceElement = document.getElementById(preferenceName)

    if (preferenceObj.type === 'select') {
      preferenceElement.value = preferenceObj.status
    } else if (preferenceObj.type === 'checkbox') {
      preferenceElement.checked = preferenceObj.status
    }
  }
}

async function onCheckBoxChanged (e) {
  const target = e.target
  const targetId = target.id

  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const preference = storedPreferences[targetId]

  if (!preference) return

  preference.status = target.checked

  try {
    await storage.save('preferences', storedPreferences)
  } catch (error) {
    console.error('An error occurred:', error)
    target.checked = !target.checked
  }
}

async function onSelectChanged (e) {
  const target = e.target
  const targetId = target.id

  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const preference = storedPreferences[targetId]

  if (!preference) return

  preference.status = target.value

  try {
    await storage.save('preferences', storedPreferences)
  } catch (error) {
    console.error('An error occurred:', error)
    target.value = storage.defaults[targetId].status
  }
}

async function onButtonClicked (e) {
  const target = e.target
  const targetId = target.id

  if (targetId === 'export') {
    const notes = await storage.load('notes', []).catch((error) => {
      console.error('An error occurred:', error)
    })

    if (notes.length === 0) return

    for (const note of notes) {
      const title = note.title.replace(/\s+/g, '_')
      const created = new Date(note.created)
      const date = created
        .toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        })
        .replace(/\//g, '_')
      const filename = `${title}_${date}`
      const content = note.text

      // create a data URL from the file content
      const dataURL = `data:text/plain;charset=utf-8,${encodeURIComponent(
        content
      )}`

      // create a temporary anchor element to trigger the download
      const link = document.createElement('a')
      link.href = dataURL
      link.download = filename

      // append the anchor element to the document body and trigger a click event
      document.body.appendChild(link)
      link.click()

      // remove the anchor element from the document body
      document.body.removeChild(link)
    }
  } else if (targetId === 'rate') {
    let url = `https://chrome.google.com/webstore/detail/${chrome.runtime.id}/reviews`

    try {
      await tabs.create(url)
    } catch (error) {
      console.error('An error occurred:', error)
    }
  } else if (targetId === 'shortcut') {
    let url = 'chrome://extensions/shortcuts'

    try {
      await tabs.create(url)
    } catch (error) {
      console.error('An error occurred:', error)
    }
  }
}