'use strict'

import * as regex from './regex.js'

export function getModel (text, n) {
  const tokens = text.match(regex.TOKEN_REGEX)
  const frequencies = {}
  const model = {}

  if (!tokens) return

  for (const i in tokens) {
    if (i < tokens.length - n) {
      const gram = tokens.slice(i, parseInt(i) + n).join(' ')
      frequencies[gram] = (frequencies[gram] || 0) + 1
    }
  }

  for (const gram in frequencies) {
    const words = gram.split(' ')
    const prefix = words[0].toLowerCase()
    const word = words[1]
    model[prefix] = model[prefix] || []
    model[prefix].push({ word, count: frequencies[gram], prefix })
  }

  return model
}

export function predict (prefix, model) {
  const k = 1
  const words = model[prefix.toLowerCase()]
  if (!words) {
    return []
  }

  // count the total number of words that follow this prefix
  const totalCount = words.reduce((acc, curr) => acc + curr.count, 0)

  // calculate the probability of each word following the prefix,
  // with Laplace smoothing using a smoothing parameter k
  const probabilities = words.reduce((acc, curr) => {
    acc[curr.word] = (curr.count + k) / (totalCount + (k * words.length))
    return acc
  }, {})

  // choose a word at random, weighted by its probability
  const random = Math.random()
  let sum = 0
  for (const word in probabilities) {
    sum += probabilities[word]
    if (sum > random) {
      return [word]
    }
  }

  // if we get here, there was a rounding error or some other problem,
  // so just return the most common word
  const maxCount = Math.max(...words.map((w) => w.count))
  const topWords = words.filter((w) => w.count === maxCount)
  const chosenWord = topWords[Math.floor(Math.random() * topWords.length)]
  return [chosenWord.word]
}
