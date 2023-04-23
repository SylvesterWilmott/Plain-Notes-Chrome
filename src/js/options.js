'use strict'

import * as storage from './storage.js'
import * as i18n from './localize.js'

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
