'use strict'

export function create () {
  return Math.random().toString(36).slice(-8)
}
