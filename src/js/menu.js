'use strict'

/* global chrome */

export function create (arr) {
  return new Promise((resolve, reject) => {
    let callbacksCalled = 0

    for (const i of arr) {
      chrome.contextMenus.create(i, function () {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        } else {
          callbacksCalled++
          if (callbacksCalled === arr.length) {
            resolve()
          }
        }
      })
    }
  })
}

export function update (id, status) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.update(
      id,
      {
        checked: status
      },
      function () {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        }

        resolve()
      }
    )
  })
}
